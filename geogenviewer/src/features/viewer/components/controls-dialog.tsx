"use client";

import { useEffect, useRef } from "react";
import { copy } from "../copy";
import { CloseIcon } from "./icons";

export function ControlsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="gg-dialog"
      aria-labelledby="gg-controls-title"
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
    >
      <div className="gg-dialog__surface">
        <div className="gg-dialog__header">
          <h1 id="gg-controls-title" className="gg-dialog__title">
            {copy.controlsTitle}
          </h1>
          <button
            type="button"
            className="gg-btn gg-btn--ghost gg-btn--icon-sm"
            aria-label={copy.controlsClose}
            autoFocus
            onClick={() => dialogRef.current?.close()}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="gg-dialog__body">
          <section className="gg-dialog__section">
            <h2>{copy.controlsMouseHeading}</h2>
            <ul>
              {copy.controlsMouseItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="gg-dialog__section">
            <h2>{copy.controlsTouchHeading}</h2>
            <ul>
              {copy.controlsTouchItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="gg-dialog__section">
            <h2>{copy.controlsKeyboardHeading}</h2>
            <ul>
              {copy.controlsKeyboardItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </dialog>
  );
}
