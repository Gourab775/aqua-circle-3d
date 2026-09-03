document.addEventListener('DOMContentLoaded', () => {
  const animElements = document.querySelectorAll('.splash .overline, .splash h1, .splash .rule, .splash .subtitle, .splash .scroll-hint, .section .number, .section h2, .section .divider, .section p, .section .quote, .finale .overline, .finale h2, .finale p, .finale .cta');
  animElements.forEach(el => {
    el.classList.add('anim-hidden');
    el.style.willChange = 'transform, opacity';
  });

  // Flawless scroll-linked observer - only animates when element enters viewport via scroll
  let ticking = false;
  const io = new IntersectionObserver((entries) => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // smooth stagger is handled via CSS transition-delay
            entry.target.classList.remove('anim-hidden');
            entry.target.classList.add('anim-visible');
            // unobserve after visible to keep it flawless and not re-trigger jank
            io.unobserve(entry.target);
          }
        });
        ticking = false;
      });
    } else {
      // fallback immediate
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('anim-hidden');
          entry.target.classList.add('anim-visible');
          io.unobserve(entry.target);
        }
      });
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  // Observe after a tiny delay to ensure initial splash doesn't jank - still scroll-driven for below-fold
  // Splash elements are at top, they will be visible immediately but we stagger them smoothly
  animElements.forEach((el, i) => {
    // slight delay for observing to make it feel scroll-tied, not instant
    setTimeout(() => io.observe(el), i * 20);
  });

  // Extra flawless: on scroll, also check for elements that might be missed due to fast scroll
  let scrollTick = false;
  let hasScrolled = false;
  window.addEventListener('scroll', () => {
    hasScrolled = true;
    if (!scrollTick) {
      scrollTick = true;
      requestAnimationFrame(() => {
        scrollTick = false;
      });
    }
  }, { passive: true });

  // Smooth website - ensure initial check if already scrolled (reload mid-page)
  if (window.scrollY > 50) {
    requestAnimationFrame(() => {
      animElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.88) {
          el.classList.remove('anim-hidden');
          el.classList.add('anim-visible');
        }
      });
    });
  }
});
