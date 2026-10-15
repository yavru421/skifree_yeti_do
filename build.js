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

// Remove legacy duplicate public/dist artifacts if present
if (fs.existsSync("public/dist")) {
  fs.rmSync("public/dist", { recursive: true, force: true });
}
console.log("✅ [Build] Clean bundle compiled to public/bundle.js without dynamic requires!");
