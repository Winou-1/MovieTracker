class ToastManager {
    constructor() {
        this.toasts = [];
        this.container = null;
        this.maxToasts = 5;
        this.init();
    }
    
    init() {
        this.container = document.createElement('div');
        this.container.id = 'toastContainer';
        this.container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 16px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-width: 280px;
            pointer-events: none;
        `;
        document.body.appendChild(this.container);
    }
    
    show(message, type = 'success', duration = 3000) {
        const toast = this.createToast(message, type);
        this.toasts.push(toast);
        if (this.toasts.length > this.maxToasts) {
            const oldToast = this.toasts.shift();
            this.removeToast(oldToast, true);
        }
        this.container.appendChild(toast.element);
        requestAnimationFrame(() => {
            toast.element.style.transform = 'translateX(0)';
            toast.element.style.opacity = '1';
        });
        this.repositionToasts();
        toast.timeout = setTimeout(() => {
            this.removeToast(toast);
        }, duration);
        
        return toast;
    }
    
    createToast(message, type) {
        const colors = {
            success: { bg: 'linear-gradient(135deg, #10b981, #059669)', icon: '✓' },
            error: { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: '✕' },
            warning: { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: '⚠' },
            info: { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', icon: 'ℹ' }
        };
        
        const config = colors[type] || colors.info;
        
        const element = document.createElement('div');
        element.className = `toast toast-${type}`;
        element.style.cssText = `
            background: ${config.bg};
            color: white;
            padding: 10px 14px;
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3),
                        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
            font-weight: 600;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            transform: translateX(320px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            pointer-events: all;
            cursor: pointer;
            backdrop-filter: blur(10px);
            min-width: 220px;
            max-width: 280px;
            word-wrap: break-word;
        `;
        
        element.innerHTML = `
            <div style="
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.25);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 700;
                flex-shrink: 0;
            ">
                ${config.icon}
            </div>
            <div style="flex: 1; line-height: 1.3; font-size: 12px;">
                ${message}
            </div>
            <button style="
                background: rgba(255, 255, 255, 0.2);
                border: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                line-height: 1;
                flex-shrink: 0;
                transition: all 0.3s ease;
            " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                ×
            </button>
        `;
        
        const toast = { element, type, message };
        
        const closeBtn = element.querySelector('button');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeToast(toast);
        });
        
        element.addEventListener('click', () => {
            this.removeToast(toast);
        });
        
        element.addEventListener('mouseenter', () => {
            if (toast.timeout) {
                clearTimeout(toast.timeout);
                toast.timeout = null;
            }
        });
        
        element.addEventListener('mouseleave', () => {
            toast.timeout = setTimeout(() => {
                this.removeToast(toast);
            }, 2000);
        });
        
        return toast;
    }
    
    removeToast(toast, instant = false) {
        if (!toast || !toast.element.parentNode) return;
        
        if (toast.timeout) {
            clearTimeout(toast.timeout);
        }
        
        if (instant) {
            toast.element.remove();
        } else {
            toast.element.style.transform = 'translateX(350px)';
            toast.element.style.opacity = '0';
            
            setTimeout(() => {
                if (toast.element.parentNode) {
                    toast.element.remove();
                }
            }, 300);
        }
        
        const index = this.toasts.indexOf(toast);
        if (index > -1) {
            this.toasts.splice(index, 1);
        }
        
        this.repositionToasts();
    }
    
    repositionToasts() {
    }
    
    clear() {
        this.toasts.forEach(toast => this.removeToast(toast, true));
        this.toasts = [];
    }
}

const toastManager = new ToastManager();

function showToast(message, type = 'success') {
    toastManager.show(message, type);
}

window.toastManager = toastManager;
window.showToast = showToast;