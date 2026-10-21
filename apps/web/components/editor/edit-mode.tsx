'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { MapMessage, Shell } from '@/components/workspace/shell';
import { ScaleDialog } from '@/components/workspace/place-dialogs';
import { NO_SELECTION, useLayoutEditor } from '@/lib/editor/use-layout-editor';
import type { Building, Floor, FloorMap } from '@/lib/types';
import { useMediaQuery } from '@/lib/use-media-query';
import { usePlanOpacity } from '@/lib/use-plan-opacity';
import { EditorToolbar } from './editor-toolbar';
import { Inspector } from './inspector';
import { LayoutEditor, type Tool } from './layout-editor';
import { ShortcutsDialog } from './shortcuts-dialog';
import { useClipboard } from './use-clipboard';

/**
 * The workspace in "Edit layout" mode: editor canvas in the middle, inspector on the right.
 * On smaller screens the inspector is a panel under the canvas (the canvas stays usable).
 */
export function EditMode({
  map,
  building,
  sidebar,
  title,
  headerEnd,
  onFloorDeleted,
  onBuildingDeleted,
  onFloorCreated,
}: {
  map: FloorMap;
  building: Building | undefined;
  sidebar: ReactNode;
  title: ReactNode;
  headerEnd: ReactNode;
  onFloorDeleted: () => void;
  onBuildingDeleted: () => void;
  onFloorCreated: (floor: Floor) => void;
}) {
  const t = useTranslations('mode');
  const te = useTranslations('editor');
  const editor = useLayoutEditor(map);
  const clipboard = useClipboard(editor, map.floor);
  const [tool, setTool] = useState<Tool>('select');
  const [measured, setMeasured] = useState<number | null>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const [floorPanel, setFloorPanel] = useState(false);
  const [opacity] = usePlanOpacity();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const inspector = (
    <Inspector
      map={map}
      building={building}
      editor={editor}
      clipboard={clipboard}
      onFloorDeleted={onFloorDeleted}
      onBuildingDeleted={onBuildingDeleted}
      onFloorCreated={onFloorCreated}
    />
  );
  const hasSelection = editor.selection.seats.length > 0 || editor.selection.rooms.length > 0;
  const panelOpen = !isDesktop && (hasSelection || floorPanel);

  return (
    <Shell
      sidebar={sidebar}
      title={title}
      headerEnd={headerEnd}
      detailsLabel={t('edit')}
      main={
        <div className="flex h-full flex-col">
          <div className="relative min-h-0 flex-1">
            <LayoutEditor
              key={map.floor.id}
              map={map}
              editor={editor}
              tool={tool}
              setTool={setTool}
              planOpacity={opacity}
              onMeasured={(units) => {
                setMeasured(units);
                setTool('select');
              }}
              onShowShortcuts={() => setShortcuts(true)}
              clipboard={clipboard}
            />
            <EditorToolbar
              tool={tool}
              setTool={setTool}
              onUndo={editor.undo}
              onRedo={editor.redo}
              canUndo={editor.canUndo}
              canRedo={editor.canRedo}
              saving={editor.saving}
              onPaste={() => clipboard.paste() && setTool('select')}
              onShortcuts={() => setShortcuts(true)}
              onSettings={isDesktop ? undefined : () => setFloorPanel((open) => !open)}
            />
          </div>
          {panelOpen && (
            <section
              aria-label={t('edit')}
              className="max-h-[45dvh] shrink-0 overflow-y-auto border-t bg-background px-4 pb-4"
              data-testid="mobile-inspector"
            >
              {/* its own row, so the close button never covers the panel's content */}
              <div className="sticky top-0 z-10 -mx-4 mb-1 flex justify-end bg-background px-2 pt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={te('closePanel')}
                  onClick={() => {
                    setFloorPanel(false);
                    editor.setSelection(NO_SELECTION);
                  }}
                >
                  <X />
                </Button>
              </div>
              {inspector}
            </section>
          )}
          <ScaleDialog floorId={map.floor.id} units={measured} onClose={() => setMeasured(null)} />
          <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
        </div>
      }
      details={isDesktop ? inspector : null}
    />
  );
}

export function EditLoading() {
  return <MapMessage text="" />;
}
