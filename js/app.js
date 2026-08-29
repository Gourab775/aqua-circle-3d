document.addEventListener('DOMContentLoaded', () => {
      const animElements = document.querySelectorAll('.splash .overline, .splash h1, .splash .rule, .splash .subtitle, .splash .scroll-hint, .section .number, .section h2, .section .divider, .section p, .section .quote, .finale .overline, .finale h2, .finale p, .finale .cta');
      animElements.forEach(el => el.classList.add('anim-hidden'));
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('anim-hidden');
            entry.target.classList.add('anim-visible');
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
      animElements.forEach(el => observer.observe(el));
    });