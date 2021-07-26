# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.7.2](https://github.com/unjs/ipx/compare/v0.7.1...v0.7.2) (2021-07-26)


### Features

* default to not upscaling images ([#41](https://github.com/unjs/ipx/issues/41)) ([162f730](https://github.com/unjs/ipx/commit/162f7308650416905b33ab2c031c5fc7b82ef13b))

### [0.7.1](https://github.com/unjs/ipx/compare/v0.7.0...v0.7.1) (2021-07-02)


### Bug Fixes

* handle background number ([2f82a56](https://github.com/unjs/ipx/commit/2f82a56893004e6797b23ef40c2940155fde63f4))
* resize with width and hight ([3ca70a0](https://github.com/unjs/ipx/commit/3ca70a017d86a2d907a935eaf6ffab901424bffb))
* support background with rotate ([b6c8f8c](https://github.com/unjs/ipx/commit/b6c8f8cb1310d18134d0ade2e4c023d3d7a1936c))

## [0.7.0](https://github.com/unjs/ipx/compare/v0.6.7...v0.7.0) (2021-07-01)


### ⚠ BREAKING CHANGES

* **pkg:** add exports field
* move modifiers to path from query

### Features

* `reqOptions` and `bypassDomain` ([fc8c7b5](https://github.com/unjs/ipx/commit/fc8c7b5b655d61e23f6f63af82669ed23e48eec5))
* **pkg:** add exports field ([394384f](https://github.com/unjs/ipx/commit/394384f19364845e228aedeee598d8960d263c7e))
* move modifiers to path from query ([b7570d9](https://github.com/unjs/ipx/commit/b7570d942bf282da38acdc79b34c6e33177611c0))


### Bug Fixes

* don't prepend trailing slash to external id ([01e151a](https://github.com/unjs/ipx/commit/01e151a90c0601802bf197cf28542d24fae1c3b4))

### [0.6.7](https://github.com/unjs/ipx/compare/v0.6.6...v0.6.7) (2021-07-01)

### Bug Fixes

- **middleware:** set res.body ([d7dc146](https://github.com/unjs/ipx/commit/d7dc1466224310e583d6c595a3c1e67b00f4a13f))

### [0.6.6](https://github.com/unjs/ipx/compare/v0.6.5...v0.6.6) (2021-07-01)

### [0.6.5](https://github.com/unjs/ipx/compare/v0.6.4...v0.6.5) (2021-07-01)

### Features

- expose handleRequest ([7c8c857](https://github.com/unjs/ipx/commit/7c8c857fc4a84d57ee8c2a5919f0b397c2e1b220))

### Bug Fixes

- **filesystem:** handle when input is not a file ([9e1f7bf](https://github.com/unjs/ipx/commit/9e1f7bf73463b0958362bfa1443f1db24058410a))

### [0.6.4](https://github.com/unjs/ipx/compare/v0.6.3...v0.6.4) (2021-07-01)

### Bug Fixes

- enforce leadingSlash for alias resolution ([3092e00](https://github.com/unjs/ipx/commit/3092e00870a29cb797c1c3b6cb921497523800fa))

### [0.6.3](https://github.com/unjs/ipx/compare/v0.6.2...v0.6.3) (2021-06-30)

### Bug Fixes

- content-type of svg files ([#38](https://github.com/unjs/ipx/issues/38)) ([a7a1b3b](https://github.com/unjs/ipx/commit/a7a1b3b8fb3c1b996ec823d80d029a11a19b9311))

### [0.6.2](https://github.com/unjs/ipx/compare/v0.6.1...v0.6.2) (2021-06-29)

### Features

- experimental animated support (ref [#35](https://github.com/unjs/ipx/issues/35)) ([d93fdfa](https://github.com/unjs/ipx/commit/d93fdfa1d591e70b89084a7f50d37343a7d68df8))
- support id alias ([#32](https://github.com/unjs/ipx/issues/32)) ([d4356cf](https://github.com/unjs/ipx/commit/d4356cfc28f23000e3e25f597d49eb164da580b3))
- **http:** use hostname for domain validation ([da5ca74](https://github.com/unjs/ipx/commit/da5ca74b0a57f5e47b1927f282fdda7228e54f58)), closes [nuxt/image#343](https://github.com/nuxt/image/issues/343)

### Bug Fixes

- apply context modifiers first (resolves [#33](https://github.com/unjs/ipx/issues/33)) ([cf9effd](https://github.com/unjs/ipx/commit/cf9effd1f8b390c51507f2b18d2a69de921017fd))
- default modifiers to empty object ([00d5c1d](https://github.com/unjs/ipx/commit/00d5c1d262a300469d24dc5a92c4a9940f2f0483))

### [0.6.1](https://github.com/unjs/ipx/compare/v0.6.0...v0.6.1) (2021-05-26)

## [0.6.0](https://github.com/unjs/ipx/compare/v0.5.8...v0.6.0) (2021-02-15)

### ⚠ BREAKING CHANGES

- improved handlers and format support

### Features

- improved handlers and format support ([f4f6e58](https://github.com/unjs/ipx/commit/f4f6e586119e5c9c7c81354277b42e2d3406bb96))

### [0.5.8](https://github.com/unjs/ipx/compare/v0.5.7...v0.5.8) (2021-02-08)

### Bug Fixes

- **ipx:** handle when modifiers not provided ([4efebd8](https://github.com/unjs/ipx/commit/4efebd88963cfd054004810207874553e89e5d61))

### [0.5.7](https://github.com/unjs/ipx/compare/v0.5.6...v0.5.7) (2021-02-08)

### Bug Fixes

- override meta.type and meta.mimeType if format modifier used ([820f1e2](https://github.com/unjs/ipx/commit/820f1e253dcbd0fe1122a742bb75dcfc364b868b))

### [0.5.6](https://github.com/unjs/ipx/compare/v0.5.5...v0.5.6) (2021-02-04)

### Bug Fixes

- remove extra space ([6df3504](https://github.com/unjs/ipx/commit/6df350413d2cab1b4d4a4c9f8b8a92bd906cc8f5))

### [0.5.5](https://github.com/unjs/ipx/compare/v0.5.4...v0.5.5) (2021-02-04)

### Bug Fixes

- add public and s-maxage ([bfd9727](https://github.com/unjs/ipx/commit/bfd9727ac867d0af390f56dd939347f5183d1763))

### [0.5.4](https://github.com/unjs/ipx/compare/v0.5.3...v0.5.4) (2021-02-04)

### Bug Fixes

- **http:** user headers.get ([9cf5aeb](https://github.com/unjs/ipx/commit/9cf5aebaff8f8fe86014993ac4c91590bc5a6134))

### [0.5.3](https://github.com/unjs/ipx/compare/v0.5.2...v0.5.3) (2021-02-04)

### Bug Fixes

- fix max-age cache header name ([833272b](https://github.com/unjs/ipx/commit/833272b6a4c63c388e941c8f037118c204a8dac4))
- **types:** optional ipxOptions ([692ab1f](https://github.com/unjs/ipx/commit/692ab1f6c64fa86d77581bebdcabf0ba707b9469))

### [0.5.2](https://github.com/unjs/ipx/compare/v0.5.1...v0.5.2) (2021-02-03)

### Features

- support meta, content-type and svg handling ([37592e7](https://github.com/unjs/ipx/commit/37592e711d166df41c29f1b1117adb186d42ce5d))

### Bug Fixes

- only giveup svg if no format modifier set ([f5ce8b7](https://github.com/unjs/ipx/commit/f5ce8b7aecd18629b7a116dc6aecd5096d4573aa))

### [0.5.1](https://github.com/unjs/ipx/compare/v0.5.0...v0.5.1) (2021-02-03)

### Bug Fixes

- **pkg:** export index.ts ([6125bbb](https://github.com/unjs/ipx/commit/6125bbb79ad430294f5d371d9a08f8ecca5c8372))

## [0.5.0](https://github.com/unjs/ipx/compare/v0.4.8...v0.5.0) (2021-02-03)

### ⚠ BREAKING CHANGES

- rewrite ipx

### Features

- rewrite ipx ([a60fb0d](https://github.com/unjs/ipx/commit/a60fb0d44b96c9f135af3295730c3da13fbc3e6c))

### [0.4.8](https://github.com/unjs/ipx/compare/v0.4.7...v0.4.8) (2020-12-23)

### Bug Fixes

- update allowList import ([a26cae0](https://github.com/unjs/ipx/commit/a26cae00faa4fea7c190e3fb4efdf5fa1d137095))

### [0.4.7](https://github.com/unjs/ipx/compare/v0.4.6...v0.4.7) (2020-12-23)

### Bug Fixes

- **pkg:** update exports ([584cfe4](https://github.com/unjs/ipx/commit/584cfe4c341da6e10a7da28a20afe6b4d9aeff0a))

### [0.4.6](https://github.com/unjs/ipx/compare/v0.4.5...v0.4.6) (2020-11-30)

### [0.4.5](https://github.com/unjs/ipx/compare/v0.4.4...v0.4.5) (2020-11-30)

### Bug Fixes

- prevent unknow format error ([#18](https://github.com/unjs/ipx/issues/18)) ([3f338be](https://github.com/unjs/ipx/commit/3f338be630c76fd2d91901462cc3d5b495719882))

### [0.4.4](https://github.com/unjs/ipx/compare/v0.4.3...v0.4.4) (2020-11-27)

### Features

- add background operation ([#16](https://github.com/unjs/ipx/issues/16)) ([b1a0178](https://github.com/unjs/ipx/commit/b1a0178c2522bba1361a8973bf338fe0ae1cab86))

### [0.4.3](https://github.com/unjs/ipx/compare/v0.4.2...v0.4.3) (2020-11-25)

### Features

- allow gif images ([#15](https://github.com/unjs/ipx/issues/15)) ([51dcfc1](https://github.com/unjs/ipx/commit/51dcfc1dc0a076eca2c33ce5fcaf37b970964bca))

### [0.4.2](https://github.com/unjs/ipx/compare/v0.4.1...v0.4.2) (2020-11-18)

### Bug Fixes

- support `HttpAgent` with `remote` input ([#14](https://github.com/unjs/ipx/issues/14)) ([699b671](https://github.com/unjs/ipx/commit/699b6717d1b6f817edb784d50cd5f2ce8da5d21a))

### [0.4.1](https://github.com/unjs/ipx/compare/v0.4.0...v0.4.1) (2020-11-12)

### Features

- allow overiding `sharp.options` ([#13](https://github.com/unjs/ipx/issues/13)) ([ae7244d](https://github.com/unjs/ipx/commit/ae7244d83712d352e4fd08fa2106122aac6f2689))

## [0.4.0](https://github.com/unjs/ipx/compare/v0.4.0-rc.1...v0.4.0) (2020-11-05)

### Features

- support svg files ([#9](https://github.com/unjs/ipx/issues/9)) ([a020904](https://github.com/unjs/ipx/commit/a02090436e0116de641fa3d415dfeae1bee79379))

### Bug Fixes

- remove meta ([a490fb6](https://github.com/unjs/ipx/commit/a490fb6bb13a5f215a1ffb39b6acbf6d5de85aca))
- support adapter on client ([4ffd7e8](https://github.com/unjs/ipx/commit/4ffd7e84553b4b13dbb15bee801d27d014b9dc08))
