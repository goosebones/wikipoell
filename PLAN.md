# Wikipoell — plan

Work still ahead, now that the rebuilt site is live.

## MCP server

The server is public and read-only, so it needs no auth. Site search finds entities (models, materials, colors, codes) rather than garments. `find_garments` is therefore the tool assistants will lean on most, and `search` helps them find the ids to filter by.

1. A read-only MCP endpoint at `/api/mcp` (Streamable HTTP, in a route handler). Its tools wrap existing lib functions:
   - `search` (`lib/search.ts`)
   - `find_garments` (`getGarmentCards`, with the filter format from `lib/filters.ts`)
   - `get_garment`
   - `similar_garments` (`getSimilarGarments`)
   - `decode_article_code` (`lib/article-code.ts`, plus the count of matching garments)
   - `codebook` (types, procedures, processes)

   Responses stay compact: ids, titles, codes and URLs.

2. Rate limiting for the public endpoint, and a short "Use with AI assistants" note on the codebook page explaining how to connect.

## Ingest pipeline rework

This is planned separately. It brings back the `/api/ingest/*` routes and the re-check queue, and moves `wikipoell-ingest/` to the new schema. The pipeline is paused until then.

## Revisit

- **Sort options.** Newest, model and title exist today (`SORTS` in `lib/garments.ts`). Title and model may not be very useful, so choose which sorts to offer.

## Maybe, later

- Grouping listings of the same garment across retailers.
- A "recently added" feed.
- "I own this": marking owned pieces, with a choice of showing them on your profile.
