# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## v1.0.0

[compare changes](https://github.com/unjs/ipx/compare/v1.0.0-2...v1.0.0)


### 🏡 Chore

  - Update dependencies ([be8facd](https://github.com/unjs/ipx/commit/be8facd))
  - Fix lint issue ([f4c0532](https://github.com/unjs/ipx/commit/f4c0532))
  - Update release script ([eab8d46](https://github.com/unjs/ipx/commit/eab8d46))

### 🎨 Styles

  - Format with prettier ([9713626](https://github.com/unjs/ipx/commit/9713626))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## [1.0.0-2](https://github.com/unjs/ipx/compare/v1.0.0-1...v1.0.0-2) (2022-11-24)

## [1.0.0-1](https://github.com/unjs/ipx/compare/v1.0.0-0...v1.0.0-1) (2022-11-23)


### Bug Fixes

* update defu import ([c55f878](https://github.com/unjs/ipx/commit/c55f878671d340b04f8e3e5ae8ea2849809280d9))

## [1.0.0-0](https://github.com/unjs/ipx/compare/v0.9.11...v1.0.0-0) (2022-11-23)


### Bug Fixes

* use utc format for `Last-Modified` header ([#89](https://github.com/unjs/ipx/issues/89)) ([1cb0b6d](https://github.com/unjs/ipx/commit/1cb0b6dbefc394b1da6125916db4bb46b6e4a967))

### [0.9.11](https://github.com/unjs/ipx/compare/v0.9.10...v0.9.11) (2022-09-03)


### Features

* **middleware:** add `Content-Security-Policy` header ([#83](https://github.com/unjs/ipx/issues/83)) ([d1edbf1](https://github.com/unjs/ipx/commit/d1edbf120759697e04259b3708784d05b38f7190))


### Bug Fixes

* use `hasProtocol` rather than checking if url starts with `http` ([#80](https://github.com/unjs/ipx/issues/80)) ([696ba5a](https://github.com/unjs/ipx/commit/696ba5a2473b4d1e95222678d59ddfaa9406b6b1))

### [0.9.10](https://github.com/unjs/ipx/compare/v0.9.9...v0.9.10) (2022-07-07)


### Bug Fixes

* return promise from middleware ([2fb644d](https://github.com/unjs/ipx/commit/2fb644da6c5e2ea52a08db7aed11fd373ac612a1))

### [0.9.9](https://github.com/unjs/ipx/compare/v0.9.8...v0.9.9) (2022-06-22)


### Bug Fixes

* **http:** handle domains without protocol and port ([a5b4614](https://github.com/unjs/ipx/commit/a5b46149a3c67f9a7418fdb9ec6474f2e1429f0b))

### [0.9.8](https://github.com/unjs/ipx/compare/v0.9.7...v0.9.8) (2022-06-22)


### Bug Fixes

* **http:** use hostname to compare against domains ([3aabc41](https://github.com/unjs/ipx/commit/3aabc4134e7a9e6f52588815fc51d610fc03324d))

### [0.9.7](https://github.com/unjs/ipx/compare/v0.9.6...v0.9.7) (2022-06-22)


### Bug Fixes

* **fs:** fix windows path validation ([c631a2b](https://github.com/unjs/ipx/commit/c631a2b11109c306a7460e29a11d852b27301206))

### [0.9.6](https://github.com/unjs/ipx/compare/v0.9.5...v0.9.6) (2022-06-20)

### [0.9.5](https://github.com/unjs/ipx/compare/v0.9.4...v0.9.5) (2022-06-20)


### Features

* `fetchOptions` ([#74](https://github.com/unjs/ipx/issues/74)) ([4d0f235](https://github.com/unjs/ipx/commit/4d0f2352b442c47bfe4ff954f927a94c572bb342))
* enable animated by default for gif (closes [#53](https://github.com/unjs/ipx/issues/53)) ([155afac](https://github.com/unjs/ipx/commit/155afacd70e3bb130a14df61d7c5f1f3062d0b3f))
* global `maxAge` option ([#71](https://github.com/unjs/ipx/issues/71)) ([a2481dc](https://github.com/unjs/ipx/commit/a2481dc6ca154b89a89aa537965198069a650f37))
* **middleware:** allow extended modifier seperators ([a47d2aa](https://github.com/unjs/ipx/commit/a47d2aa86e15b7f5bc43220a3d8d2c06147d7c11)), closes [#57](https://github.com/unjs/ipx/issues/57)


### Bug Fixes

* improve path validation (resolves [#56](https://github.com/unjs/ipx/issues/56)) ([ec5c15d](https://github.com/unjs/ipx/commit/ec5c15d2ecfa3a5c9c550b918f84cf2f87085f90))
* **middleware:** sanetize request and response strings (resolves [#42](https://github.com/unjs/ipx/issues/42)) ([1792d3a](https://github.com/unjs/ipx/commit/1792d3aa2f4e572e0ca09cdac7272f60402cf3ea))
* use `response.arrayBuffer` instead of deprecated `res.buffer` ([b13a77e](https://github.com/unjs/ipx/commit/b13a77e0884e5d4dbb2f7ea7de43ea05e9581698)), closes [#69](https://github.com/unjs/ipx/issues/69)

### [0.9.4](https://github.com/unjs/ipx/compare/v0.9.3...v0.9.4) (2022-02-17)


### Bug Fixes

* revert back cjs entry ([a9f42b9](https://github.com/unjs/ipx/commit/a9f42b926a77ead3daf84f0ae7946c2e490edd45))

### [0.9.3](https://github.com/unjs/ipx/compare/v0.9.2...v0.9.3) (2022-02-15)


### Features

* Added 'position' option for resize ([#55](https://github.com/unjs/ipx/issues/55)) ([f89dea7](https://github.com/unjs/ipx/commit/f89dea781abc9ad916b431f15cf1c6fa31b0d1ad))
* update dependencies ([99dfd0e](https://github.com/unjs/ipx/commit/99dfd0e771da2753614585e103305a354f2e7857)), closes [/sharp.pixelplumbing.com/changelog#v0300---1st-february-2022](https://github.com/unjs//sharp.pixelplumbing.com/changelog/issues/v0300---1st-february-2022)


### Bug Fixes

* allow resize operator with only width ([4662f4e](https://github.com/unjs/ipx/commit/4662f4eaf720a30499179fa66608c853d333e269))

### [0.9.2](https://github.com/unjs/ipx/compare/v0.9.1...v0.9.2) (2022-01-31)


### Bug Fixes

* use whatwg-url for parsing hostname ([a5ee0b5](https://github.com/unjs/ipx/commit/a5ee0b59ded16c9b48661bfc70f17c0b2fdd87ea))

### [0.9.1](https://github.com/unjs/ipx/compare/v0.9.0...v0.9.1) (2021-11-05)


### Bug Fixes

* restore `ipx` command (resolves [#51](https://github.com/unjs/ipx/issues/51)) ([9a26c4b](https://github.com/unjs/ipx/commit/9a26c4b18c3f226612fd871f64d9cbc705cda621))

## [0.9.0](https://github.com/unjs/ipx/compare/v0.8.0...v0.9.0) (2021-10-27)


### ⚠ BREAKING CHANGES

* Sharp is being lazy loaded
* Several dependencies changes for better ESM compatibility

### Features

* lazy load sharp ([9cf14dc](https://github.com/unjs/ipx/commit/9cf14dca95d81e0fa71cc5fe9122d4280e528195))


### Bug Fixes

* update image-meta import ([a278cf1](https://github.com/unjs/ipx/commit/a278cf1b0a14409d2000f3ad48758cae02f96f1c))
* use ohmyfetch for cjs support ([39e78b9](https://github.com/unjs/ipx/commit/39e78b9060a11457bd3b26ec8906982091f3eb1d))

## [0.8.0](https://github.com/unjs/ipx/compare/v0.7.2...v0.8.0) (2021-09-05)


### ⚠ BREAKING CHANGES

* update sharp to 0.29.0 ([b5a06fb](https://github.com/unjs/ipx/commit/b5a06fbdd2d5e0caf12f8c8a3d389ebed2744425)), [changelog](https://github.com/lovell/sharp/blob/master/docs/changelog.md#v0290---17th-august-2021)

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
