'use client';

import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { MapMessage, Shell } from '@/components/workspace/shell';
import { ScaleDialog } from '@/components/workspace/place-dialogs';
import { useLayoutEditor } from '@/lib/editor/use-layout-editor';
import type { Building, FloorMap } from '@/lib/types';
import { usePlanOpacity } from '@/lib/use-plan-opacity';
import { EditorToolbar } from './editor-toolbar';
import { Inspector } from './inspector';
import { LayoutEditor, type Tool } from './layout-editor';

/** The workspace in "Edit layout" mode: editor canvas in the middle, inspector on the right. */
export function EditMode({
  map,
  building,
  sidebar,
  title,
  headerEnd,
  onFloorDeleted,
  onBuildingDeleted,
}: {
  map: FloorMap;
  building: Building | undefined;
  sidebar: ReactNode;
  title: ReactNode;
  headerEnd: ReactNode;
  onFloorDeleted: () => void;
  onBuildingDeleted: () => void;
}) {
  const t = useTranslations('mode');
  const editor = useLayoutEditor(map);
  const [tool, setTool] = useState<Tool>('select');
  const [measured, setMeasured] = useState<number | null>(null);
  const [opacity] = usePlanOpacity();

  return (
    <Shell
      sidebar={sidebar}
      title={title}
      headerEnd={headerEnd}
      detailsLabel={t('edit')}
      main={
        <>
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
          />
          <EditorToolbar
            tool={tool}
            setTool={setTool}
            onUndo={editor.undo}
            onRedo={editor.redo}
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            saving={editor.saving}
          />
          <ScaleDialog floorId={map.floor.id} units={measured} onClose={() => setMeasured(null)} />
        </>
      }
      details={
        <Inspector
          map={map}
          building={building}
          editor={editor}
          onFloorDeleted={onFloorDeleted}
          onBuildingDeleted={onBuildingDeleted}
        />
      }
    />
  );
}

export function EditLoading() {
  return <MapMessage text="" />;
}
