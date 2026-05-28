const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const iconsDir = path.join(__dirname, 'public/assets/icons');
const srcDir = path.join(__dirname, 'src');

// Function to get all used SVGs
function getUsedIcons() {
    try {
        // Grep for /public/assets/icons/ or /assets/icons/
        const grepCmd = `grep -roh "/assets/icons/[a-zA-Z0-9_.-]*\\.svg" ${srcDir} index.html 2>/dev/null`;
        const result = execSync(grepCmd, { encoding: 'utf-8' });
        
        const used = new Set();
        result.split('\n').forEach(line => {
            const match = line.match(/\/assets\/icons\/([^/]+\.svg)/);
            if (match) {
                used.add(match[1]);
            }
        });
        return used;
    } catch (e) {
        // If grep returns 1 (no matches) or fails, we catch it here.
        console.log("Error running grep or no matches found.");
        return new Set();
    }
}

const usedIcons = getUsedIcons();
console.log(`Found ${usedIcons.size} explicitly used icons in src/ and index.html`);

// Ensure we don't accidentally delete anything critical if grep fails
if (usedIcons.size === 0) {
    console.log("Aborting to prevent deleting all icons.");
    process.exit(1);
}

// Read all files in public/assets/icons/
const allIcons = fs.readdirSync(iconsDir).filter(f => f.endsWith('.svg'));
let deleted = 0;

allIcons.forEach(icon => {
    // If it's not explicitly used
    if (!usedIcons.has(icon)) {
        // As an extra safety, don't delete things that start with ic_ or custom user SVGs we know are safe
        // But the user specifically said "remaining remove".
        // Wait, what if they are dynamically referenced? like `${badgeIcon}.svg`?
        // Let's check for dynamic references!
        if (icon === 'check-circle.svg' || icon === 'x-circle.svg' || icon === 'refresh-cw.svg' || icon === 'info.svg') {
            // These are used dynamically via badgeIcon
            return;
        }
        
        const iconPath = path.join(iconsDir, icon);
        fs.unlinkSync(iconPath);
        deleted++;
        console.log(`Deleted unused icon: ${icon}`);
    }
});

console.log(`Deleted ${deleted} unused SVGs. Kept ${allIcons.length - deleted} SVGs.`);
