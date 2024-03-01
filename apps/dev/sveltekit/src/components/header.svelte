<script lang="ts">
  import { page } from "$app/stores"
  import { Authorized, LogOut } from "@auth/sveltekit/components"
</script>

<header>
  <nav class="nojs-show loaded">
    <div class="nav-left">
      <img
        alt="Avatar"
        src={$page.data.session?.user?.image ??
          "https://source.boringavatars.com/beam/120"}
        class="avatar"
      />
    </div>
    <div class="nav-right">
      {#if $page.data.session}
        <span class="header-text">
          <small>Log in as</small><br />
          <strong>
            {$page.data.session.user?.email ?? $page.data.session.user?.name}
          </strong>
        </span>
        <LogOut>
          <!-- TODO -->
          <!-- svelte-ignore ts7053 -->
          <div class="buttonPrimary" slot="submitButton">Log out</div>
        </LogOut>
      {:else}
        <span class="header-text">You are not log in</span>
        <!-- TODO -->
        <Authorized provider="google">
          <div class="buttonPrimary" slot="submitButton">Log in</div>
         </Authorized>
      {/if}
    </div>
  </nav>
  <div class="links">
    <a class="linkItem" href="/">Home</a>
    <a class="linkItem" href="/protected">Protected</a>
  </div>
</header>
