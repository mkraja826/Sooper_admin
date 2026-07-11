function clickButtonByText(selector: string, text: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>(selector)).find((item) =>
    item.textContent?.trim().toLowerCase().includes(text.toLowerCase()),
  );
  button?.click();
  return Boolean(button);
}

function openControls(tab: 'clinics' | 'staff' | 'subscriptions' = 'clinics', clinicName = '', createClinic = false) {
  const launcher = document.querySelector<HTMLButtonElement>('.ac-launcher');
  launcher?.click();

  window.setTimeout(() => {
    const tabText = tab === 'staff' ? 'Staff & invites' : tab === 'subscriptions' ? 'Subscriptions' : 'Clinics';
    clickButtonByText('.ac-tabs button', tabText);

    window.setTimeout(() => {
      if (createClinic) clickButtonByText('.ac-list-head button', 'New');
      if (clinicName) {
        const clinicButton = Array.from(document.querySelectorAll<HTMLButtonElement>('.ac-clinic-list > button')).find((item) =>
          item.querySelector('strong')?.textContent?.trim() === clinicName,
        );
        clinicButton?.click();
      }
    }, 50);
  }, 50);
}

function handleDashboardAction(event: MouseEvent) {
  const target = event.target as Element | null;
  const button = target?.closest<HTMLButtonElement>('button');
  if (!button || button.closest('.ac-shell') || button.classList.contains('ac-launcher')) return;

  const label = button.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
  let handled = false;

  if (label.includes('create clinic') || label.includes('add clinic')) {
    openControls('clinics', '', true);
    handled = true;
  } else if (label.includes('invite staff')) {
    openControls('staff');
    handled = true;
  } else if (label.includes('invite clinic owner')) {
    window.dispatchEvent(new CustomEvent('sooperadmin:invite-owner'));
    handled = true;
  } else if (label.includes('configure') || label === 'suspend' || label === 'reactivate') {
    const clinicName = document.querySelector<HTMLElement>('.cp-drawer h2')?.textContent?.trim() || '';
    openControls('clinics', clinicName);
    handled = Boolean(clinicName);
  }

  if (handled) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
}

document.addEventListener('click', handleDashboardAction, true);
