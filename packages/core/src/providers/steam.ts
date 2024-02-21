/**
 * <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
 * <span style={{fontSize: "1.35rem" }}>
 *  Built-in sign in with <b>Steam</b> integration.
 * </span>
 * <a href="https://steamcommunity.com" style={{backgroundColor: "black", padding: "12px", borderRadius: "100%" }}>
 *   <img style={{display: "block"}} src="https://steamcommunity-a.akamaihd.net/public/images/signinthroughsteam/sits_01.png" width="24"/>
 * </a>
 * </div>
 *
 * @module providers/steam
 */
import type { OIDCConfig, OIDCUserConfig } from "./index.js"

/** The returned user profile from Steam when using the profile callback. */
export interface SteamProfile extends Record<string, any> {
  steamid: string
  personaname: string
  profileurl: string
  avatar: string
}

/**
 * ### Setup
 *
 * #### Callback URL
 * ```
 * https://example.com/api/auth/callback/steam
 * ```
 * 
 * #### Configuration
 *
 * Import the provider and configure it in your **Auth.js** initialization file:
 *
 * ```ts title="auth.ts"
 * import NextAuth from "next-auth"
 * import SteamProvider from "next-auth/providers/steam"
 * 
 * export default NextAuth({
 *   providers: [
 *      SteamProvider({
 *        clientId: process.env.STEAM_ID,
 *        clientSecret: process.env.STEAM_SECRET,
 *      }),
 *   ],
 * })
 * ```
 * 
 * ### Resources
 *
 * - [Steam OpenID Documentation](https://partner.steamgames.com/doc/features/auth#1)
 *
 * ### Notes
 *
 * The Steam provider comes with a [default configuration](https://github.com/nextauthjs/next-auth/blob/main/packages/core/src/providers/steam.ts). To override the defaults for your use case, check out [customizing a built-in OAuth provider](https://authjs.dev/guides/providers/custom-provider#override-default-options).
 *
 * ## Help
 *
 * If you think you found a bug in the default configuration, you can [open an issue](https://authjs.dev/new/provider-issue).
 *
 * Auth.js strictly adheres to the specification and it cannot take responsibility for any deviation from
 * the spec by the provider. You can open an issue, but if the problem is non-compliance with the spec,
 * we might not pursue a resolution. You can ask for more help in [Discussions](https://authjs.dev/new/github-discussions).
 */

export default function Steam(
  config: OIDCUserConfig<SteamProfile>
): OIDCConfig<SteamProfile> {
  return {
    id: "steam",
    name: "Steam",
    type: "oidc",
    style: { logo: "/steam.svg", text: "#fff", bg: "#000000" },
    options: config,
  }
}
