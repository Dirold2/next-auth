<script lang="ts">
  import { enhance } from "$app/forms"
  import type { signout } from "$lib/actions"

  export let className = ""
  export let options: Parameters<typeof signout>[0] = undefined
  export let SignOutPage = "signout"
  
</script>

<form
  method="POST"
  action={`/${SignOutPage}`}
  use:enhance
  class={`logOutButton ${className}`}
  {...$$restProps}
>
  {#if options}
    {#if options?.redirect}
      <input type="hidden" name="redirect" value={options.redirect} />
    {/if}
    {#if options?.redirectTo}
      <input type="hidden" name="redirectTo" value={options.redirectTo} />
    {/if}
  {/if}
  <button type="submit">
    <slot name="submitButton">Sign Out</slot>
  </button>
</form>
