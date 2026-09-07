'use client';

export function TenantLoadError() {
  return (
    <main className="tenant-error" role="alert">
      <div className="tenant-error__card">
        <h1 className="tenant-error__title">Unable to load elections</h1>
        <p className="tenant-error__message">
          Election data is temporarily unavailable. Please try again later.
        </p>
      </div>
    </main>
  );
}
