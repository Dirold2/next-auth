<p align="center">
  <a href="https://authjs.dev" target="_blank">
    <img width="96px" src="https://authjs.dev/img/logo/logo-sm.png" alt="Auth.js Logo">
  </a>
  <h3 align="center">Auth.js</h3>
  <p align="center">Authentication for the Web.</p>
  <p align="center">Open Source. Full Stack. Own Your Data.</p>
</p>

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## Introduction

Auth.js is a set of open-source packages that are built on standard Web APIs for authentication in modern applications with any framework on any platform in any JS runtime. It offers flexibility, security, and control over user authentication.

For more information, visit [authjs.dev](https://authjs.dev).

## Features

### Flexible and Easy to Use

- Designed to work with any OAuth service, supporting 2.0+, OIDC
- Built-in support for many popular sign-in services
- Email/Passwordless authentication
- Works with any backend (Active Directory, LDAP, etc.)
- Runtime-agnostic, runs anywhere! (Vercel Edge Functions, Node.js, Serverless, etc.)

### Own Your Data

- An open-source solution that allows you to keep control of your data
- Built-in support for various databases like MySQL, Postgres, MongoDB, etc.
- Works great with databases from popular hosting providers

### Secure by Default

- Promotes the use of passwordless sign-in mechanisms
- Designed to be secure by default and encourages best practices
- Uses CSRF Tokens on POST routes for sign in/sign out
- Default cookie policy aims for the most restrictive policy appropriate for each cookie
- Encrypts JSON Web Tokens by default (JWE) with A256CBC-HS512
- Implements the latest guidance published by OWASP

### TypeScript Support

Auth.js libraries are written with type safety in mind.

For more information, see [TypeScript Documentation](https://authjs.dev/getting-started/typescript).

## Security

If you think you have found a vulnerability in Auth.js, please read our [Security Policy](https://authjs.dev/security) to reach out responsibly.

## Contributing

We welcome all contributions! If you'd like to contribute, please read our [Contributing Guide](https://github.com/nextauthjs/.github/blob/main/CONTRIBUTING.md).

## License

Auth.js is licensed under the ISC License.