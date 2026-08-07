# Spotify Gatekeeper Specification

> **Package:** `@gadgets/spotify-gatekeeper`  
> **Status:** Normative package specification; inherits root Gatekeeper credential, observation, action and sharing rules.

## 1. Mission

The Spotify Gatekeeper exposes a connected user's Spotify account or one selected playlist to Gadgets. It covers catalog/profile/library/playlists and playback capabilities while retaining OAuth credentials and provider authority inside the Gatekeeper account object.

## 2. Resource model

Current resource types are:

- **Spotify Account:** `https://*` whole-account access;
- **Spotify Playlist:** `https://open.spotify.com/playlist/:playlistId`.

The account resource may expose profile, search, library, playlists, follows and playback operations defined by the generated session types. A playlist grant MUST restrict reads/mutations to the selected playlist and the minimum metadata necessary to operate on it.

Playlist identifiers may be normalized from an open.spotify.com URL, `spotify:playlist:<id>` URI, or accepted bare ID according to the implementation. The resulting facet scope MUST use one canonical playlist ID.

## 3. OAuth model

The package requests the Spotify scopes needed by its current API, including user profile, library, top/recent data, follow state, private/collaborative playlists, playlist modification and playback state/control.

Because the account resource is broad, the UI/spec MUST make that breadth explicit. Future resource-specific scope minimization is preferred, but a narrow playlist facet MUST still enforce scope at the Gatekeeper even when the underlying OAuth grant is broader.

Connection state uses random initiation/OAuth nonces with ten-minute expiration, a one-hour incomplete-connect cleanup window and access-token refresh safety before exact expiry.

## 4. Credential lifecycle

OAuth tokens belong exclusively to the account Durable Object. Refresh/reconnect/revoke operations MUST preserve one coherent credential generation and MUST not expose tokens to Workshop frontend/Gadgets.

Reconnect replaces credentials on the existing account capability and notifies Workshop through the standard expiry/restoration callbacks.

## 5. Observation contract

Spotify profile, search results, albums/artists/tracks, playlists, devices, playback state, history, top items and other returned provider data are protected observations.

Every read method MUST await `authorizeObservation()` before returning provider data to the Gadget. Provider text such as playlist names/descriptions is untrusted content and MUST be bounded when included in audit/approval UI.

## 6. Action contract

Library/follow changes, playlist edits and playback controls are side effects and MUST use staged Gatekeeper actions.

For each mutation:

1. validate the target against the bound account/playlist resource;
2. stage the operation and any necessary pre-state;
3. submit an `ActionDescription` before provider execution;
4. simulate the pending state where reliable;
5. call Spotify only from `applyAction()`;
6. clean simulated state on rejection;
7. implement/provider-test an inverse before advertising `implementsRevert: true`.

Playback commands can depend on ephemeral device/player state. If a command cannot be reliably simulated, it SHOULD require awaiting the approval decision rather than allowing an agent to assume the playback state changed.

## 7. Normalization

Raw Spotify API responses are normalized into stable package types for profile, artist/album/track references, playlists, images, devices and playback state.

Normalization MUST handle absent/renamed provider fields conservatively. Unknown/missing optional fields should produce documented null/default values rather than unchecked runtime assumptions.

Provider API schema changes MUST not silently change the semantic meaning of existing Gadget-facing fields.

## 8. Configurators

Account and playlist configurator UIs are sandboxed and receive only narrow lookup RPC. Playlist selection MUST resolve to one canonical playlist resource URL; no credential is exposed to the frame.

## 9. Observer/sharing policy

Shared-workspace collaborators do not automatically inherit access to private playlists, library/history or active playback state. The Gatekeeper MUST apply its observer verification policy and fail closed when independent access to the selected resource cannot be established.

Whole-account observations may contain sensitive/private listening data and SHOULD use the strongest applicable shared observation restrictions.

## 10. Security invariants

- OAuth nonce/state is random, expiring and single-use.
- Credentials remain account-owned.
- Narrow playlist scope is enforced server-side even with broad OAuth scopes.
- Every protected read authorizes before disclosure.
- Every provider side effect stages before application.
- Playback/list mutations do not claim simulation/revert guarantees they cannot provide.
- Private account/listening data is not assumed shareable.

## 11. Build/configuration

Worker entrypoint: `src/spotify.ts`. Account/playlist configurator HTML is generated from source through the shared configurator pipeline. `CLIENT_ID`/`CLIENT_SECRET` are deployment secrets/dev variables and MUST not be committed.

## 12. Tests

Tests SHOULD cover:

- nonce/reconnect/token refresh;
- playlist ID normalization and account-vs-playlist anti-widening;
- API response normalization including absent fields;
- observation authorization across profile/search/library/playback;
- stage/apply/reject/revert behavior for representative playlist/library/player actions;
- unsimulatable playback `awaitDecision` behavior;
- private-resource observer policy;
- configurator canonical URLs.

## 13. Change rules

New Spotify writes require stable action kinds, approval text, resource validation, simulation/await-decision/revert decisions and tests. Broadening playlist scope or exposing new private account datasets is an explicit security contract change and requires this spec update.
