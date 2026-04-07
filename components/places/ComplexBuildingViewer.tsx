import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { placeService } from '../../services/placeService';
import type { ComplexType } from '../../types/place';
import { shadow } from '../../utils/shadowStyles';

export type ComplexUnit = {
  id: string;
  complex_id: string;
  floor_number: number;
  unit_number: string;
  child_place_id: string | null;
  child_place_name: string | null;
  created_at: string;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

export function ComplexBuildingViewer({
  placeId,
  complexType,
  floorsCount,
  unitsPerFloor,
  onUnitPress,
}: {
  placeId: string;
  complexType: ComplexType;
  floorsCount: number;
  unitsPerFloor: number;
  onUnitPress?: (unit: ComplexUnit) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [units, setUnits] = React.useState<ComplexUnit[]>([]);
  const [openFloors, setOpenFloors] = React.useState<Record<number, boolean>>({});

  const accent = complexType === 'residential' ? '#2563EB' : '#F97316';
  const unitLabel = complexType === 'residential' ? 'بيت' : 'وحدة';
  const floorAccentBg = complexType === 'residential' ? '#EFF6FF' : '#FFF7ED';
  const floorAccentBorder = complexType === 'residential' ? '#BFDBFE' : '#FED7AA';
  const cardBg = complexType === 'residential' ? '#F8FAFF' : '#FFF9F3';

  const loadUnits = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Ensure all unit rows exist (idempotent)
      const generated = await placeService.generateUnits(placeId, floorsCount, unitsPerFloor);
      const nextUnits = (generated || []) as ComplexUnit[];
      setUnits(nextUnits);
    } catch {
      // Fallback: try just fetching existing units
      try {
        const data = await placeService.getComplex(placeId);
        setUnits((data.units || []) as ComplexUnit[]);
      } catch (e: any) {
        setUnits([]);
        setError(e?.message || 'تعذّر تحميل وحدات المجمّع');
      }
    } finally {
      setLoading(false);
    }
  }, [placeId, floorsCount, unitsPerFloor]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadUnits();
      if (!cancelled) {
        const nextOpen: Record<number, boolean> = {};
        for (let f = 1; f <= Math.max(1, floorsCount || 1); f++) nextOpen[f] = false;
        setOpenFloors(nextOpen);
      }
    })();
    return () => { cancelled = true; };
  }, [loadUnits]);

  const unitsByFloor = React.useMemo(() => {
    const map = new Map<number, ComplexUnit[]>();
    for (const u of units) {
      const f = Number(u.floor_number);
      const list = map.get(f) ?? [];
      list.push(u);
      map.set(f, list);
    }
    for (const [f, list] of map.entries()) {
      list.sort((a, b) => String(a.unit_number).localeCompare(String(b.unit_number), 'ar', { numeric: true }));
      map.set(f, list);
    }
    return map;
  }, [units]);

  const floors = React.useMemo(() => {
    const max = Math.max(1, floorsCount || 1);
    const arr: number[] = [];
    for (let f = max; f >= 1; f--) arr.push(f);
    return arr;
  }, [floorsCount]);

  /** Refresh units after a new unit is linked (called from parent) */
  React.useImperativeHandle(
    React.useRef(null),
    () => ({ refresh: loadUnits }),
    [loadUnits],
  );

  if (loading) {
    return (
      <View style={[styles.card, { borderColor: accent + '33' }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>المجمّع</Text>
          <View style={[styles.headerDot, { backgroundColor: accent }]} />
        </View>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={accent} />
          <Text style={styles.loadingText}>جارٍ تحميل الوحدات…</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.card, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: '#991B1B' }]}>المجمّع</Text>
        </View>
        <Text style={[styles.errorText, { color: '#991B1B' }]}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderColor: accent + '33' }]}>
      <View style={[styles.roof, { backgroundColor: accent }]}>
        <Text style={styles.roofText}>
          {complexType === 'residential' ? 'مجمّع سكني' : 'مجمّع تجاري'} · طوابق: {floorsCount} · وحدات/طابق: {unitsPerFloor}
        </Text>
      </View>

      <View style={[styles.body, { backgroundColor: cardBg }]}>
        {floors.map((floor) => {
          const floorUnits = unitsByFloor.get(floor) ?? [];
          const open = openFloors[floor] !== false;
          const rows = chunk(floorUnits, 4);
          return (
            <View key={floor} style={styles.floorBlock}>
              <Pressable
                style={[
                  styles.floorHeader,
                  { borderColor: floorAccentBorder, backgroundColor: floorAccentBg },
                ]}
                onPress={() => setOpenFloors((prev) => ({ ...prev, [floor]: !open }))}
              >
                <View style={styles.floorHeaderLeft}>
                  <Text style={styles.floorHeaderArrow}>{open ? '▾' : '▸'}</Text>
                </View>
                <View style={styles.floorHeaderRight}>
                  <View style={[styles.floorBadge, { backgroundColor: accent + '1A', borderColor: accent + '55' }]}>
                    <Text style={[styles.floorBadgeText, { color: accent }]}>{floor}</Text>
                  </View>
                  <Text style={styles.floorHeaderText}>الطابق</Text>
                </View>
              </Pressable>

              {open && (
                <View style={styles.floorUnitsWrap}>
                  {rows.length === 0 ? (
                    <Text style={styles.emptyFloorText}>لا توجد وحدات لهذا الطابق</Text>
                  ) : (
                    rows.map((r, idx) => (
                      <View key={idx} style={styles.unitsRow}>
                        {r.map((u) => {
                          const linked = !!u.child_place_id && !!u.child_place_name;
                          return (
                            <Pressable
                              key={u.id}
                              style={[
                                styles.unitTile,
                                {
                                  borderColor: linked ? accent + '55' : '#E5E7EB',
                                  backgroundColor: linked ? accent + '14' : '#F8FAFC',
                                  borderStyle: linked ? 'solid' : 'dashed',
                                },
                              ]}
                              onPress={() => onUnitPress?.(u)}
                            >
                              <View style={styles.unitTopRow}>
                                <Text style={styles.unitNumber}>{u.unit_number}</Text>
                                <View
                                  style={[
                                    styles.unitDot,
                                    { backgroundColor: linked ? accent : '#CBD5E1' },
                                  ]}
                                />
                              </View>
                              <Text style={styles.unitLabel} numberOfLines={1}>
                                {linked ? u.child_place_name : `${unitLabel} ${floor}-${u.unit_number}`}
                              </Text>
                              <Text style={styles.unitHint} numberOfLines={1}>
                                {linked ? 'عرض' : '+ إضافة'}
                              </Text>
                            </Pressable>
                          );
                        })}
                        {r.length < 4 &&
                          Array.from({ length: 4 - r.length }).map((_, i) => (
                            <View key={`sp-${i}`} style={styles.unitSpacer} />
                          ))}
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginTop: 12,
    ...shadow({ offset: { width: 0, height: 3 }, opacity: 0.08, radius: 10, elevation: 6 }),
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 15, fontWeight: '900', color: '#111827', textAlign: 'right' },
  headerDot: { width: 10, height: 10, borderRadius: 5 },
  loadingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 14 },
  loadingText: { color: '#6B7280', fontWeight: '700', textAlign: 'right' },
  errorText: { paddingHorizontal: 14, paddingBottom: 14, fontWeight: '700', textAlign: 'right' },

  roof: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  roofText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  body: { padding: 12, backgroundColor: '#fff' },

  floorBlock: { marginBottom: 10 },
  floorHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.06, radius: 6, elevation: 2 }),
  },
  floorHeaderLeft: { width: 24, alignItems: 'flex-start', justifyContent: 'center' },
  floorHeaderRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  floorHeaderText: { fontSize: 13, fontWeight: '900', color: '#1F2937', textAlign: 'right' },
  floorHeaderArrow: { fontSize: 14, fontWeight: '900', color: '#334155' },
  floorBadge: {
    minWidth: 28,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  floorBadgeText: { fontSize: 12, fontWeight: '900' },

  floorUnitsWrap: { paddingTop: 10, gap: 10 },
  unitsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'space-between',
  },
  unitTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    gap: 6,
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.04, radius: 5, elevation: 1 }),
  },
  unitSpacer: { flex: 1, minWidth: 0 },
  unitTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitNumber: { fontSize: 14, fontWeight: '900', color: '#111827' },
  unitDot: { width: 10, height: 10, borderRadius: 5 },
  unitLabel: { fontSize: 12, fontWeight: '800', color: '#334155', textAlign: 'right' },
  unitHint: { fontSize: 11, fontWeight: '700', color: '#64748B', textAlign: 'right' },
  emptyFloorText: { color: '#9CA3AF', fontWeight: '700', textAlign: 'right' },
});
