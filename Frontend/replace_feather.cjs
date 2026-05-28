const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function replaceFeather(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            replaceFeather(filePath);
        } else if (filePath.endsWith('.js') && !filePath.endsWith('.bak')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let modified = false;

            // Using a regex to match the full <i ...> or <svg ...> tag and its contents.
            const regex = /<(i|svg)([^>]*?)data-feather="([^"]+)"([^>]*?)>([\s\S]*?)<\/\1>/gi;
            
            content = content.replace(regex, (match, tag, beforeFeather, icon, afterFeather, innerContent) => {
                modified = true;
                const attributesStr = (beforeFeather + " " + afterFeather).trim();
                
                let style = "";
                const styleMatch = attributesStr.match(/style="([^"]*)"/i);
                
                let classStr = "extracted-svg";
                const classMatch = attributesStr.match(/class="([^"]*)"/i);
                if (classMatch) {
                    classStr += " " + classMatch[1].trim();
                }

                if (styleMatch) {
                    style = styleMatch[1].trim();
                    if (!style.endsWith(';')) style += '; ';
                    else style += ' ';
                }
                
                // Add default display inline-block if not present
                if (!style.includes('display:')) {
                    style += 'display: inline-block; ';
                }
                
                // Defaults for width/height if missing
                if (!style.includes('width:')) style += 'width: 18px; ';
                if (!style.includes('height:')) style += 'height: 18px; ';
                
                // Include mask properties
                let baseIconPath = `/public/assets/icons/${icon}.svg`;
                // Wait! If icon is a template literal variable like ${badgeIcon}, we need to not quote it as a string but interpolate it.
                // Oh wait, ${badgeIcon} is ALREADY inside a template literal in JS, so it evaluates perfectly.
                style += `-webkit-mask-image: url(/public/assets/icons/${icon}.svg); mask-image: url(/public/assets/icons/${icon}.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;`;

                return `<span class="${classStr}" style="${style}"></span>`;
            });

            if (modified) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated: ${filePath}`);
            }
        }
    });
}

replaceFeather(directoryPath);
