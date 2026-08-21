// logica-carrusel.js

// Lógica de pestañas (Tabs) y Carga Perezosa (Lazy Load)
function showBrand(brandName, btnElement) {
    // 1. Quitar la clase 'active' de todos los botones
    const tabs = document.querySelectorAll('.brand-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // 2. Añadir la clase 'active' al botón clickeado
    btnElement.classList.add('active');
    
    // 3. Ocultar todos los carruseles
    const carousels = document.querySelectorAll('.carousel-bg-card');
    carousels.forEach(c => {
        c.style.display = 'none';
        c.classList.remove('active-brand');
    });
    
    // 4. Mostrar el carrusel seleccionado
    const targetCarousel = document.getElementById('brand-' + brandName);
    targetCarousel.style.display = 'block';
    targetCarousel.classList.add('active-brand');

    // ==========================================
    // OPTIMIZACIÓN: CARGA DE IMÁGENES AL CLIC
    // ==========================================
    // Busca todas las imágenes de esta marca que tengan el atributo temporal "data-src"
    const lazyImages = targetCarousel.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
        img.src = img.getAttribute('data-src'); // Transforma data-src en src real (inicia la descarga)
        img.removeAttribute('data-src'); // Limpia el atributo temporal
    });
}

// Lógica de deslizamiento y Auto-Play
const carousels = document.querySelectorAll('.carousel-wrapper');
carousels.forEach(wrapper => {
    const track = wrapper.querySelector('.carousel-track');
    const prevBtn = wrapper.querySelector('.prev-btn');
    const nextBtn = wrapper.querySelector('.next-btn');
    
    let autoPlayInterval;
    
    function moveSlide(direction) {
        const scrollAmount = 345;
        track.scrollBy({ left: scrollAmount * direction, behavior: 'smooth' });
        resetAutoPlay();
    }
    
    if (prevBtn) prevBtn.onclick = () => moveSlide(-1);
    if (nextBtn) nextBtn.onclick = () => moveSlide(1);
    
    function startAutoPlay() {
        autoPlayInterval = setInterval(() => {
            if (wrapper.offsetParent === null) return;
            if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 10) {
                track.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                moveSlide(1);
            }
        }, 4000);
    }
    
    function resetAutoPlay() {
        clearInterval(autoPlayInterval);
        startAutoPlay();
    }
    
    startAutoPlay();
    track.addEventListener('mouseenter', () => clearInterval(autoPlayInterval));
    track.addEventListener('mouseleave', startAutoPlay);
    track.addEventListener('touchstart', () => clearInterval(autoPlayInterval));
    track.addEventListener('touchend', startAutoPlay);
});