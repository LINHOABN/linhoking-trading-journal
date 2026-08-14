from pathlib import Path

dist_dir = Path("frontend/dist")
css_files = list((dist_dir / "assets").glob("*.css"))
js_files = list((dist_dir / "assets").glob("*.js"))

if not css_files or not js_files:
    print("Error: CSS or JS dist files not found")
    exit(1)

css_file = css_files[0]
js_file = js_files[0]

css_content = css_file.read_text(encoding="utf-8")
js_content = js_file.read_text(encoding="utf-8")

bundle_path = Path("backend/app/static_bundle.py")
with open(bundle_path, "w", encoding="utf-8") as f:
    f.write(f'CSS_FILENAME = "{css_file.name}"\n')
    f.write(f'JS_FILENAME = "{js_file.name}"\n')
    f.write(f'CSS_CONTENT = {repr(css_content)}\n')
    f.write(f'JS_CONTENT = {repr(js_content)}\n')

print(f"Successfully generated {bundle_path} with {len(css_content)} bytes CSS and {len(js_content)} bytes JS.")
