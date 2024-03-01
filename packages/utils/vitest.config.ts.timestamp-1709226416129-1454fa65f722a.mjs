// ../utils/vitest.config.ts
import { defineConfig } from "file:///P:/DEV/GIT/let/next-auth/node_modules/.pnpm/vite@5.1.4_@types+node@18.11.10/node_modules/vite/dist/node/index.js";
import swc from "file:///P:/DEV/GIT/let/next-auth/node_modules/.pnpm/unplugin-swc@1.4.4_@swc+core@1.4.2/node_modules/unplugin-swc/dist/index.mjs";
import preact from "file:///P:/DEV/GIT/let/next-auth/node_modules/.pnpm/@preact+preset-vite@2.8.1_@babel+core@7.23.9_preact@10.19.6_vite@5.1.4/node_modules/@preact/preset-vite/dist/esm/index.mjs";
var vitest_config_default = defineConfig({
  test: {
    // NOTE: `.spec` is reserved for Playwright tests
    include: ["**/*.test.?(c|m)[jt]s?(x)"],
    coverage: {
      all: true,
      enabled: true,
      include: ["src"],
      reporter: ["json", "html"]
    },
    setupFiles: ["../utils/vitest-setup.ts"]
  },
  plugins: [swc.vite(), preact()]
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vdXRpbHMvdml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIlA6XFxcXERFVlxcXFxHSVRcXFxcbGV0XFxcXG5leHQtYXV0aFxcXFxwYWNrYWdlc1xcXFx1dGlsc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiUDpcXFxcREVWXFxcXEdJVFxcXFxsZXRcXFxcbmV4dC1hdXRoXFxcXHBhY2thZ2VzXFxcXHV0aWxzXFxcXHZpdGVzdC5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1A6L0RFVi9HSVQvbGV0L25leHQtYXV0aC9wYWNrYWdlcy91dGlscy92aXRlc3QuY29uZmlnLnRzXCI7Ly8vIDxyZWZlcmVuY2UgdHlwZXM9XCJ2aXRlc3RcIiAvPlxyXG5cclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIlxyXG5pbXBvcnQgc3djIGZyb20gXCJ1bnBsdWdpbi1zd2NcIlxyXG5pbXBvcnQgcHJlYWN0IGZyb20gXCJAcHJlYWN0L3ByZXNldC12aXRlXCJcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgdGVzdDoge1xyXG4gICAgLy8gTk9URTogYC5zcGVjYCBpcyByZXNlcnZlZCBmb3IgUGxheXdyaWdodCB0ZXN0c1xyXG4gICAgaW5jbHVkZTogW1wiKiovKi50ZXN0Lj8oY3xtKVtqdF1zPyh4KVwiXSxcclxuICAgIGNvdmVyYWdlOiB7XHJcbiAgICAgIGFsbDogdHJ1ZSxcclxuICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgaW5jbHVkZTogW1wic3JjXCJdLFxyXG4gICAgICByZXBvcnRlcjogW1wianNvblwiLCBcImh0bWxcIl0sXHJcbiAgICB9LFxyXG4gICAgc2V0dXBGaWxlczogW1wiLi4vdXRpbHMvdml0ZXN0LXNldHVwLnRzXCJdLFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW3N3Yy52aXRlKCksIHByZWFjdCgpXSxcclxufSlcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUVBLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sU0FBUztBQUNoQixPQUFPLFlBQVk7QUFHbkIsSUFBTyx3QkFBUSxhQUFhO0FBQUEsRUFDMUIsTUFBTTtBQUFBO0FBQUEsSUFFSixTQUFTLENBQUMsMkJBQTJCO0FBQUEsSUFDckMsVUFBVTtBQUFBLE1BQ1IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLE1BQ1QsU0FBUyxDQUFDLEtBQUs7QUFBQSxNQUNmLFVBQVUsQ0FBQyxRQUFRLE1BQU07QUFBQSxJQUMzQjtBQUFBLElBQ0EsWUFBWSxDQUFDLDBCQUEwQjtBQUFBLEVBQ3pDO0FBQUEsRUFDQSxTQUFTLENBQUMsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDO0FBQ2hDLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
