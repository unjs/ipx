# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.5.7](https://github.com/nuxt-contrib/ipx/compare/v0.5.6...v0.5.7) (2021-02-08)


### Bug Fixes

* override meta.type and meta.mimeType if format modifier used ([820f1e2](https://github.com/nuxt-contrib/ipx/commit/820f1e253dcbd0fe1122a742bb75dcfc364b868b))

### [0.5.6](https://github.com/nuxt-contrib/ipx/compare/v0.5.5...v0.5.6) (2021-02-04)


### Bug Fixes

* remove extra space ([6df3504](https://github.com/nuxt-contrib/ipx/commit/6df350413d2cab1b4d4a4c9f8b8a92bd906cc8f5))

### [0.5.5](https://github.com/nuxt-contrib/ipx/compare/v0.5.4...v0.5.5) (2021-02-04)


### Bug Fixes

* add public and s-maxage ([bfd9727](https://github.com/nuxt-contrib/ipx/commit/bfd9727ac867d0af390f56dd939347f5183d1763))

### [0.5.4](https://github.com/nuxt-contrib/ipx/compare/v0.5.3...v0.5.4) (2021-02-04)


### Bug Fixes

* **http:** user headers.get ([9cf5aeb](https://github.com/nuxt-contrib/ipx/commit/9cf5aebaff8f8fe86014993ac4c91590bc5a6134))

### [0.5.3](https://github.com/nuxt-contrib/ipx/compare/v0.5.2...v0.5.3) (2021-02-04)


### Bug Fixes

* fix max-age cache header name ([833272b](https://github.com/nuxt-contrib/ipx/commit/833272b6a4c63c388e941c8f037118c204a8dac4))
* **types:** optional ipxOptions ([692ab1f](https://github.com/nuxt-contrib/ipx/commit/692ab1f6c64fa86d77581bebdcabf0ba707b9469))

### [0.5.2](https://github.com/nuxt-contrib/ipx/compare/v0.5.1...v0.5.2) (2021-02-03)


### Features

* support meta, content-type and svg handling ([37592e7](https://github.com/nuxt-contrib/ipx/commit/37592e711d166df41c29f1b1117adb186d42ce5d))


### Bug Fixes

* only giveup svg if no format modifier set ([f5ce8b7](https://github.com/nuxt-contrib/ipx/commit/f5ce8b7aecd18629b7a116dc6aecd5096d4573aa))

### [0.5.1](https://github.com/nuxt-contrib/ipx/compare/v0.5.0...v0.5.1) (2021-02-03)


### Bug Fixes

* **pkg:** export index.ts ([6125bbb](https://github.com/nuxt-contrib/ipx/commit/6125bbb79ad430294f5d371d9a08f8ecca5c8372))

## [0.5.0](https://github.com/nuxt-contrib/ipx/compare/v0.4.8...v0.5.0) (2021-02-03)


### ⚠ BREAKING CHANGES

* rewrite ipx

### Features

* rewrite ipx ([a60fb0d](https://github.com/nuxt-contrib/ipx/commit/a60fb0d44b96c9f135af3295730c3da13fbc3e6c))

### [0.4.8](https://github.com/nuxt-contrib/ipx/compare/v0.4.7...v0.4.8) (2020-12-23)


### Bug Fixes

* update allowList import ([a26cae0](https://github.com/nuxt-contrib/ipx/commit/a26cae00faa4fea7c190e3fb4efdf5fa1d137095))

### [0.4.7](https://github.com/nuxt-contrib/ipx/compare/v0.4.6...v0.4.7) (2020-12-23)


### Bug Fixes

* **pkg:** update exports ([584cfe4](https://github.com/nuxt-contrib/ipx/commit/584cfe4c341da6e10a7da28a20afe6b4d9aeff0a))

### [0.4.6](https://github.com/nuxt-contrib/ipx/compare/v0.4.5...v0.4.6) (2020-11-30)

### [0.4.5](https://github.com/nuxt-contrib/ipx/compare/v0.4.4...v0.4.5) (2020-11-30)


### Bug Fixes

* prevent unknow format error ([#18](https://github.com/nuxt-contrib/ipx/issues/18)) ([3f338be](https://github.com/nuxt-contrib/ipx/commit/3f338be630c76fd2d91901462cc3d5b495719882))

### [0.4.4](https://github.com/nuxt-contrib/ipx/compare/v0.4.3...v0.4.4) (2020-11-27)


### Features

* add background operation ([#16](https://github.com/nuxt-contrib/ipx/issues/16)) ([b1a0178](https://github.com/nuxt-contrib/ipx/commit/b1a0178c2522bba1361a8973bf338fe0ae1cab86))

### [0.4.3](https://github.com/nuxt-contrib/ipx/compare/v0.4.2...v0.4.3) (2020-11-25)


### Features

* allow gif images ([#15](https://github.com/nuxt-contrib/ipx/issues/15)) ([51dcfc1](https://github.com/nuxt-contrib/ipx/commit/51dcfc1dc0a076eca2c33ce5fcaf37b970964bca))

### [0.4.2](https://github.com/nuxt-contrib/ipx/compare/v0.4.1...v0.4.2) (2020-11-18)


### Bug Fixes

* support `HttpAgent` with `remote` input ([#14](https://github.com/nuxt-contrib/ipx/issues/14)) ([699b671](https://github.com/nuxt-contrib/ipx/commit/699b6717d1b6f817edb784d50cd5f2ce8da5d21a))

### [0.4.1](https://github.com/nuxt-contrib/ipx/compare/v0.4.0...v0.4.1) (2020-11-12)


### Features

* allow overiding `sharp.options` ([#13](https://github.com/nuxt-contrib/ipx/issues/13)) ([ae7244d](https://github.com/nuxt-contrib/ipx/commit/ae7244d83712d352e4fd08fa2106122aac6f2689))

## [0.4.0](https://github.com/nuxt-contrib/ipx/compare/v0.4.0-rc.1...v0.4.0) (2020-11-05)


### Features

* support svg files ([#9](https://github.com/nuxt-contrib/ipx/issues/9)) ([a020904](https://github.com/nuxt-contrib/ipx/commit/a02090436e0116de641fa3d415dfeae1bee79379))


### Bug Fixes

* remove meta ([a490fb6](https://github.com/nuxt-contrib/ipx/commit/a490fb6bb13a5f215a1ffb39b6acbf6d5de85aca))
* support adapter on client ([4ffd7e8](https://github.com/nuxt-contrib/ipx/commit/4ffd7e84553b4b13dbb15bee801d27d014b9dc08))
