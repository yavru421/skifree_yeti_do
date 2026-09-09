import esbuild from "esbuild";
import path from "path";
import fs from "fs";

const emptyShim = path.resolve("src/client/shims/empty.js");

await esbuild.build({
  entryPoints: ["src/client/main.ts"],
  bundle: true,
  outfile: "public/bundle.js",
  minify: true,
  sourcemap: true,
  plugins: [
    {
      name: "ignore-khr-interactivity",
      setup(build) {
        build.onResolve({ filter: /KHR_interactivity|interactivityUtils/ }, () => {
          return { path: emptyShim };
        });
      }
    }
  ]
});

// Also mirror to public/dist/bundle.js
if (!fs.existsSync("public/dist")) {
  fs.mkdirSync("public/dist", { recursive: true });
}
fs.copyFileSync("public/bundle.js", "public/dist/bundle.js");
if (fs.existsSync("public/bundle.js.map")) {
  fs.copyFileSync("public/bundle.js.map", "public/dist/bundle.js.map");
}
console.log("✅ [Build] Clean bundle compiled to public/bundle.js without dynamic requires!");
