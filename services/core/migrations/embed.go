// Package migrations embeds the SQL migrations into the core binary, so a
// deployment is one file with nothing to copy alongside it.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
