import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

/**
 * Returns the HTML string for the cropper modal.
 * This should be appended to the DOM wherever the cropper is needed.
 */
export function renderCropperModal() {
    return `
    <!-- Reusable Cropper Modal -->
    <div id="cropper-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center;">
        <div style="background:white; padding:20px; border-radius:8px; width:90%; max-width:600px; text-align:center; position:relative;">
            <h3 style="margin-top:0; margin-bottom:1.5rem; font-weight:800; color:#0f172a;">Adjust Your ID Card</h3>
            <div style="max-height:400px; overflow:hidden; background:#f1f5f9; border-radius:0.5rem; margin-bottom:15px; display:flex; justify-content:center; align-items:center;">
                <img id="cropper-image" style="max-width:100%; max-height:350px; display:block;">
            </div>
            
            <div class="button-group" style="display:flex; justify-content:center; gap:0.75rem; align-items:center; margin-bottom:1.5rem;">
                <button type="button" id="rotate-left-btn" style="background:none; border:none; cursor:pointer; color:#475569; padding:8px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='none'" title="Rotate Left">
                    <span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/Rotate_left.svg); mask-image: url(/assets/icons/Rotate_left.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
                </button>
                <button type="button" id="rotate-right-btn" style="background:none; border:none; cursor:pointer; color:#475569; padding:8px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='none'" title="Rotate Right">
                    <span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/Rotate_right.svg); mask-image: url(/assets/icons/Rotate_right.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
                </button>
                <div style="width:1px; height:24px; background:#e2e8f0; margin:0 0.5rem;"></div>
                <button type="button" id="zoom-in-btn" style="background:none; border:none; cursor:pointer; color:#475569; padding:8px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='none'" title="Zoom In">
                    <span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/Maximize.svg); mask-image: url(/assets/icons/Maximize.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
                </button>
                <button type="button" id="zoom-out-btn" style="background:none; border:none; cursor:pointer; color:#475569; padding:8px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='none'" title="Zoom Out">
                    <span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/Minimize.svg); mask-image: url(/assets/icons/Minimize.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
                </button>
            </div>
            <div class="button-group" style="display:flex; justify-content:space-between; gap:10px; margin-top:15px;">
                <button type="button" id="cancel-crop-btn" style="background:#e2e8f0; border:none; color:#475569; padding:0.6rem 1.25rem; border-radius:0.5rem; font-weight:700; cursor:pointer;">Cancel</button>
                <button type="button" id="crop-btn" style="background:#6366f1; border:none; color:white; padding:0.6rem 2rem; border-radius:0.5rem; font-weight:700; cursor:pointer;">Confirm & Save</button>
            </div>
        </div>
    </div>`;
}

/**
 * Initializes the Cropper on a given container or document body.
 *
 * @param {string} imageSrc - The Data URL or Blob URL of the image to crop.
 * @param {object} options - Configuration object.
 * @param {function} options.onCrop - Callback when user clicks 'Confirm & Save'. Receives (blob, canvas).
 * @param {function} options.onCancel - Callback when user clicks 'Cancel'.
 * @param {HTMLElement|Document} options.container - The DOM element containing the cropper modal. Defaults to document.
 */
export function initCropper(imageSrc, { onCrop, onCancel, container = document } = {}) {
    const cropperModal = container.querySelector('#cropper-modal');
    const cropperImage = container.querySelector('#cropper-image');
    
    if (!cropperModal || !cropperImage) {
        console.error('ImageCropper: Modal or Image element not found in the provided container.');
        return;
    }

    // Set the image source
    cropperImage.src = imageSrc;
    
    // Display the modal
    cropperModal.style.display = 'flex';

    // Initialize Cropper instance
    const cropperInstance = new Cropper(cropperImage, {
        viewMode: 1,
        dragMode: 'move',
        background: false,
        responsive: true,
        aspectRatio: NaN
    });

    // Button Elements
    const cropBtn = container.querySelector('#crop-btn');
    const cancelCropBtn = container.querySelector('#cancel-crop-btn');
    const rotateLeftBtn = container.querySelector('#rotate-left-btn');
    const rotateRightBtn = container.querySelector('#rotate-right-btn');
    const zoomInBtn = container.querySelector('#zoom-in-btn');
    const zoomOutBtn = container.querySelector('#zoom-out-btn');

    // Remove old listeners by cloning (to prevent memory leaks from multiple initializations)
    const replaceWithClone = (el) => {
        if (!el) return null;
        const clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);
        return clone;
    };

    const newCropBtn = replaceWithClone(cropBtn);
    const newCancelCropBtn = replaceWithClone(cancelCropBtn);
    const newRotateLeftBtn = replaceWithClone(rotateLeftBtn);
    const newRotateRightBtn = replaceWithClone(rotateRightBtn);
    const newZoomInBtn = replaceWithClone(zoomInBtn);
    const newZoomOutBtn = replaceWithClone(zoomOutBtn);

    const cleanup = () => {
        cropperModal.style.display = 'none';
        if (cropperInstance) {
            cropperInstance.destroy();
        }
    };

    if (newCropBtn) {
        newCropBtn.addEventListener('click', () => {
            const canvas = cropperInstance.getCroppedCanvas({
                maxWidth: 2000,
                maxHeight: 2000
            });

            if (canvas) {
                canvas.toBlob((blob) => {
                    cleanup();
                    if (onCrop) onCrop(blob, canvas);
                }, 'image/jpeg', 0.85);
            } else {
                cleanup();
                if (onCancel) onCancel();
            }
        });
    }

    if (newCancelCropBtn) {
        newCancelCropBtn.addEventListener('click', () => {
            cleanup();
            if (onCancel) onCancel();
        });
    }

    if (newRotateLeftBtn) {
        newRotateLeftBtn.addEventListener('click', () => {
            if (cropperInstance) cropperInstance.rotate(-90);
        });
    }

    if (newRotateRightBtn) {
        newRotateRightBtn.addEventListener('click', () => {
            if (cropperInstance) cropperInstance.rotate(90);
        });
    }

    if (newZoomInBtn) {
        newZoomInBtn.addEventListener('click', () => {
            if (cropperInstance) cropperInstance.zoom(0.1);
        });
    }

    if (newZoomOutBtn) {
        newZoomOutBtn.addEventListener('click', () => {
            if (cropperInstance) cropperInstance.zoom(-0.1);
        });
    }
}
