"use client";

import { useEffect, useRef, useState } from "react";
import {
  GEOGEN_CONTRACT_VERSION,
  GEOGEN_VERSION_LABEL,
} from "../../../lib/geogen/version";
import { clearRecentProjects, readRecentProjects } from "../../home/recent-projects";
import { useOrganizationStore } from "../state/organization-store";
import { usePresentation, type GraphicsQuality } from "../state/presentation-store";
import {
  useAppSettings,
  type DisplayUnitSystem,
  type ThemePreference,
  type ViewportBackground,
} from "../state/settings-store";
import { CloseIcon } from "./icons";

type SettingsTab = "appearance" | "navigation" | "performance" | "data" | "about";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "appearance", label: "Aparência" },
  { id: "navigation", label: "Navegação" },
  { id: "performance", label: "Desempenho" },
  { id: "data", label: "Unidades e dados" },
  { id: "about", label: "Sobre" },
];

export function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [recentCount, setRecentCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const theme = useAppSettings((s) => s.theme);
  const viewportBackground = useAppSettings((s) => s.viewportBackground);
  const showNavCube = useAppSettings((s) => s.showNavCube);
  const unitSystem = useAppSettings((s) => s.unitSystem);
  const largeModelAutoMode = useAppSettings((s) => s.largeModelAutoMode);
  const largeModelActive = useAppSettings((s) => s.largeModelActive);
  const largeModelReason = useAppSettings((s) => s.largeModelReason);
  const patchPreferences = useAppSettings((s) => s.patchPreferences);
  const resetPreferences = useAppSettings((s) => s.resetPreferences);

  const display = usePresentation((s) => s.display);
  const patchDisplay = usePresentation((s) => s.patchDisplay);
  const syncTarget = usePresentation((s) => s.syncTarget);
  const syncZoom = usePresentation((s) => s.syncZoom);
  const clearOrg = useOrganizationStore((s) => s.clearOrganization);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setRecentCount(readRecentProjects().length);
      setNotice(null);
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
      className="gg-dialog gg-settings-dialog"
      aria-labelledby="gg-settings-title"
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
    >
      <div className="gg-dialog__surface">
        <div className="gg-dialog__header">
          <h1 id="gg-settings-title" className="gg-dialog__title">
            Configurações do GeoGenViewer
          </h1>
          <button
            type="button"
            className="gg-btn gg-btn--ghost gg-btn--icon-sm"
            aria-label="Fechar configurações"
            autoFocus
            onClick={() => dialogRef.current?.close()}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="gg-settings-tabs" role="tablist" aria-label="Seções de configurações">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className="gg-settings-tab"
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="gg-dialog__body gg-settings-body">
          {tab === "appearance" && (
            <div className="gg-v05-fields">
              <label>
                Tema da interface
                <select
                  value={theme}
                  onChange={(event) =>
                    patchPreferences({ theme: event.currentTarget.value as ThemePreference })
                  }
                >
                  <option value="system">Seguir sistema operacional</option>
                  <option value="light">Claro (technical board)</option>
                  <option value="dark">Escuro (architectural studio)</option>
                </select>
              </label>
              <label>
                Fundo da viewport 3D (independente do tema)
                <select
                  value={viewportBackground}
                  onChange={(event) =>
                    patchPreferences({
                      viewportBackground: event.currentTarget.value as ViewportBackground,
                    })
                  }
                >
                  <option value="theme">Seguir tema atual</option>
                  <option value="white">Claro técnico (#f8fafc)</option>
                  <option value="dark">Grafite escuro (#181c21)</option>
                </select>
              </label>
              <label className="gg-settings-check">
                <input
                  type="checkbox"
                  checked={display.axes}
                  onChange={(event) => patchDisplay({ axes: event.currentTarget.checked })}
                />
                <span>Mostrar eixos mundiais na cena</span>
              </label>
              <label className="gg-settings-check">
                <input
                  type="checkbox"
                  checked={display.grid}
                  onChange={(event) => patchDisplay({ grid: event.currentTarget.checked })}
                />
                <span>Mostrar grade de referência</span>
              </label>
            </div>
          )}

          {tab === "navigation" && (
            <div className="gg-v05-fields">
              <label className="gg-settings-check">
                <input
                  type="checkbox"
                  checked={showNavCube}
                  onChange={(event) =>
                    patchPreferences({ showNavCube: event.currentTarget.checked })
                  }
                />
                <span>Exibir Cubo de Navegação 3D na viewport</span>
              </label>
              <label className="gg-settings-check">
                <input
                  type="checkbox"
                  checked={syncTarget}
                  onChange={(event) =>
                    usePresentation.setState({ syncTarget: event.currentTarget.checked })
                  }
                />
                <span>Sincronizar alvo entre múltiplas vistas</span>
              </label>
              <label className="gg-settings-check">
                <input
                  type="checkbox"
                  checked={syncZoom}
                  onChange={(event) =>
                    usePresentation.setState({ syncZoom: event.currentTarget.checked })
                  }
                />
                <span>Sincronizar escala ortográfica entre vistas</span>
              </label>
            </div>
          )}

          {tab === "performance" && (
            <div className="gg-v05-fields">
              <label>
                Qualidade gráfica do renderer
                <select
                  value={display.quality}
                  onChange={(event) =>
                    useAppSettings.getState().patchPreferences({ graphicsQuality: event.currentTarget.value as GraphicsQuality })
                  }
                >
                  <option value="performance">Desempenho (DPR 1x, ideal para modelos grandes)</option>
                  <option value="balanced">Equilibrada (DPR até 1.5x)</option>
                  <option value="high">Alta definição (DPR até 2x)</option>
                </select>
              </label>
              <label className="gg-settings-check">
                <input
                  type="checkbox"
                  checked={largeModelAutoMode}
                  onChange={(event) =>
                    patchPreferences({ largeModelAutoMode: event.currentTarget.checked })
                  }
                />
                <span>Ativar modo de modelo grande automaticamente (&ge; 120k triângulos ou &ge; 1.500 peças)</span>
              </label>
              <label className="gg-settings-check">
                <input
                  type="checkbox"
                  checked={display.shadows}
                  onChange={(event) => patchDisplay({ shadows: event.currentTarget.checked })}
                />
                <span>Sombras em tempo real</span>
              </label>
              <label className="gg-settings-check">
                <input
                  type="checkbox"
                  checked={display.edges}
                  onChange={(event) => patchDisplay({ edges: event.currentTarget.checked })}
                />
                <span>Contorno de arestas nos sólidos</span>
              </label>
              {largeModelActive && largeModelReason && (
                <p className="gg-org-notice">{largeModelReason}</p>
              )}
            </div>
          )}

          {tab === "data" && (
            <div className="gg-v05-fields">
              <label>
                Unidade preferencial de exibição
                <select
                  value={unitSystem}
                  onChange={(event) =>
                    patchPreferences({ unitSystem: event.currentTarget.value as DisplayUnitSystem })
                  }
                >
                  <option value="mm">Milímetros (mm)</option>
                  <option value="cm">Centímetros (cm)</option>
                  <option value="m">Metros (m)</option>
                </select>
              </label>
              <div className="gg-v05-actions">
                <button
                  type="button"
                  className="gg-btn gg-btn--secondary gg-btn--xs"
                  disabled={recentCount === 0}
                  onClick={() => {
                    clearRecentProjects();
                    setRecentCount(0);
                    setNotice("Lista de projetos recentes limpa deste navegador.");
                  }}
                >
                  Limpar recentes ({recentCount})
                </button>
                <button
                  type="button"
                  className="gg-btn gg-btn--secondary gg-btn--xs"
                  onClick={() => {
                    clearOrg();
                    setNotice("Camadas e grupos do usuário reiniciados para o modelo ativo.");
                  }}
                >
                  Limpar organização atual
                </button>
                <button
                  type="button"
                  className="gg-btn gg-btn--ghost gg-btn--xs"
                  onClick={() => {
                    resetPreferences();
                    setNotice("Preferências restauradas para o padrão.");
                  }}
                >
                  Restaurar padrões
                </button>
              </div>
              {notice && <p className="gg-org-notice" role="status">{notice}</p>}
            </div>
          )}

          {tab === "about" && (
            <div className="gg-v05-fields">
              <dl className="gg-kv-list">
                <div className="gg-kv-row">
                  <dt>Aplicação</dt>
                  <dd>GeoGenViewer {GEOGEN_VERSION_LABEL}</dd>
                </div>
                <div className="gg-kv-row">
                  <dt>Contrato CAD JSON</dt>
                  <dd className="gg-mono">v{GEOGEN_CONTRACT_VERSION}</dd>
                </div>
                <div className="gg-kv-row">
                  <dt>Processamento</dt>
                  <dd>100% local no navegador (sem upload externo)</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
