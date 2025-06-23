// /client/js/components/ui/SettingsMenu.js

/**
 * It creates its own HTML elements and manages its own state.
 */
export class SettingsMenu {
    constructor(container, initialSensX, initialSensY, onSensXChange, onSensYChange) {
        if (!container) {
            throw new Error('A container element must be provided for SettingsMenu.');
        }
        this.onSensXChange = onSensXChange;
        this.onSensYChange = onSensYChange;
        this.isVisible = false;

        this.menuContainer = document.createElement('div');
        this.menuContainer.id = 'settings-menu';
        this.menuContainer.className = 'hidden';
        
        const title = document.createElement('h2');
        title.textContent = 'Settings';
        this.menuContainer.appendChild(title);

        // --- Horizontal Sensitivity ---
        const groupX = this.createSliderGroup(
            'Horizontal Sensitivity',
            'sens-slider-x',
            initialSensX,
            this.onSensXChange
        );
        this.menuContainer.appendChild(groupX);

        // --- Vertical Sensitivity ---
         const groupY = this.createSliderGroup(
            'Vertical Sensitivity',
            'sens-slider-y',
            initialSensY,
            this.onSensYChange
        );
        this.menuContainer.appendChild(groupY);

        container.appendChild(this.menuContainer);
    }

    /**
     * Helper function to create a labeled slider group.
     */
    createSliderGroup(labelText, sliderId, initialValue, onChangeCallback) {
        const group = document.createElement('div');
        group.className = 'setting-group';

        const label = document.createElement('label');
        label.setAttribute('for', sliderId);
        label.textContent = labelText;
        group.appendChild(label);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = sliderId;
        slider.min = '0.0001';
        slider.max = '0.002';
        slider.step = '0.0001';
        slider.value = initialValue;
        group.appendChild(slider);

        const valueLabel = document.createElement('span');
        valueLabel.className = 'sensitivity-value';
        valueLabel.textContent = parseFloat(initialValue).toFixed(4);
        group.appendChild(valueLabel);

        slider.addEventListener('input', (e) => {
            const newValue = parseFloat(e.target.value);
            valueLabel.textContent = newValue.toFixed(4);
            if (onChangeCallback) {
                onChangeCallback(newValue);
            }
        });
        
        return group;
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.menuContainer.classList.toggle('hidden');
        return this.isVisible;
    }
}