export async function loadComponent(targetId, filePath) {
    try {
        const res = await fetch(filePath);

        if (!res.ok) {
            throw new Error(`Failed to load ${filePath}: ${res.status}`);
        }

        const html = await res.text();
        document.getElementById(targetId).innerHTML = html;
    } catch (err) {
        console.error(err);
        document.getElementById(targetId).innerHTML =
            `<p style="color:red">Component failed to load: ${filePath}</p>`;
    }
}

export function loadLayout() {
  loadComponent("app-header", "./components/header.html");
  loadComponent("app-footer", "./components/footer.html");
}