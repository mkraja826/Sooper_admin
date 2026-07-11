const observer = new MutationObserver(() => {
  for (const row of document.querySelectorAll<HTMLElement>('.cp-info-list > div')) {
    const label = row.querySelector('span')?.textContent?.trim();
    if (label === 'Data mode') {
      const value = row.querySelector('strong');
      if (value && value.textContent !== 'Secure read/write access') value.textContent = 'Secure read/write access';
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
