defmodule CargoTrackWsWeb.Auth do
  @moduledoc """
  JWT token verification for WebSocket connections.

  Validates HS256 tokens using the same SECRET_KEY as the Django backend.
  The `joken` library handles algorithm selection, expiry, and signature
  verification.
  """

  # Joken 2.x exposes verify_and_validate directly on the Joken module

  @secret System.get_env("JWT_SECRET_KEY", "django-insecure-dev-key")

  @signer Joken.Signer.create("HS256", @secret)

  @doc """
  Verify a JWT access token and return the payload claims.

  Returns {:ok, claims} or {:error, reason}.
  """
  def verify_token(token) when is_binary(token) do
    Joken.verify_and_validate(@signer, token)
  end

  @doc """
  Extract user info from the JWT claims.
  """
  def user_from_claims(claims) do
    %{
      "user_id" => claims["user_id"],
      "username" => claims["username"] || "",
    }
  end
end
