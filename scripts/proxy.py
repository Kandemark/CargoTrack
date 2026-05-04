"""CargoTrack API proxy — relays LAN traffic to the WSL2 Docker backend.

netsh portproxy forwards traffic at the kernel level (WFP) but external
(LAN) connections sometimes fail to reach the WSL2 VM.  This user-space
TCP relay accepts connections from any device on the LAN and proxies them
to the WSL2 IP where Docker publishes the container ports.

Usage:
    python scripts/proxy.py [wsl2-ip] [--ports 8000,5173]

The WSL2 IP is auto-detected if not provided.
"""

import asyncio
import functools
import sys
import subprocess

# Unbuffered stdout so background-process output files get logs immediately.
print = functools.partial(print, flush=True)


def get_wsl2_ip() -> str:
    """Return the IPv4 address of the docker-desktop WSL2 eth0 interface."""
    try:
        raw = subprocess.check_output(
            [
                "wsl", "-d", "docker-desktop", "--", "sh", "-c",
                "ip -4 addr show eth0 | grep inet | awk '{print $2}' | cut -d/ -f1",
            ],
            text=True,
            timeout=5,
        )
        ip = raw.strip()
        if ip:
            return ip
    except Exception:
        pass
    raise RuntimeError("Could not determine WSL2 IP. Is Docker Desktop running?")


async def pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except (ConnectionResetError, BrokenPipeError, asyncio.CancelledError):
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def handle_client(
    local_reader: asyncio.StreamReader,
    local_writer: asyncio.StreamWriter,
    target_host: str,
    target_port: int,
) -> None:
    peer = local_writer.get_extra_info("peername")
    try:
        remote_reader, remote_writer = await asyncio.wait_for(
            asyncio.open_connection(target_host, target_port),
            timeout=5,
        )
        await asyncio.gather(
            pipe(local_reader, remote_writer),
            pipe(remote_reader, local_writer),
        )
    except asyncio.TimeoutError:
        print(f"[proxy] Timeout connecting to {target_host}:{target_port}")
    except ConnectionRefusedError:
        print(f"[proxy] Connection refused by {target_host}:{target_port}")
    except Exception as exc:
        print(f"[proxy] Error proxying {peer}: {exc}")
    finally:
        try:
            local_writer.close()
        except Exception:
            pass


async def run_proxy(port: int, target_host: str) -> None:
    server = await asyncio.start_server(
        lambda r, w: handle_client(r, w, target_host, port),
        host="0.0.0.0",
        port=port,
    )
    print(f"[proxy] 0.0.0.0:{port} -> {target_host}:{port}")
    async with server:
        await server.serve_forever()


async def main() -> None:
    ports = [8000, 5173]

    # Parse command line: proxy.py [wsl2-ip] [--ports 8000,5173]
    args = sys.argv[1:]
    target = None
    for arg in args:
        if arg.startswith("--ports="):
            ports = [int(p.strip()) for p in arg.split("=", 1)[1].split(",")]
        elif not arg.startswith("--"):
            target = arg

    if target is None:
        target = get_wsl2_ip()

    print(f"[proxy] CargoTrack API proxy — WSL2 target: {target}")
    print(f"[proxy] Forwarding ports: {ports}")

    servers = [run_proxy(p, target) for p in ports]
    await asyncio.gather(*servers)


if __name__ == "__main__":
    asyncio.run(main())
