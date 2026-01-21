setTimeout(() => {
    const splashScreen = document.getElementById('splashScreen');
    if (splashScreen) {
        splashScreen.style.animation = 'splashFadeOut 0.6s ease forwards';
        setTimeout(() => {
            splashScreen.remove();
            document.body.style.overflow = '';
            document.body.style.display = '';
            document.body.style.alignItems = '';
            document.body.style.justifyContent = '';
        }, 1000);
    }
}, 3500);