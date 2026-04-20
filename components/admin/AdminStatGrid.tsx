import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { AdminScreenIcon } from './AdminScreenIcon';
import type { AdminDashboardIconName } from './adminScreenIconTypes';
import { adminScreenStyles as styles } from './AdminScreen.styles';

export interface AdminStatCardDef {
  label: string;
  value: string | number;
  icon: AdminDashboardIconName;
  webGlyph: string;
  iconColor: string;
  iconBg: string;
  alertWhenPositive?: boolean;
  onPress: () => void;
}

interface AdminStatGridProps {
  cards: AdminStatCardDef[];
}

function StatCard({ card }: { card: AdminStatCardDef }) {
  const n = typeof card.value === 'number' ? card.value : Number(card.value);
  const showAlert = card.alertWhenPositive && Number.isFinite(n) && n > 0;
  return (
    <TouchableOpacity
      style={[styles.statCard, showAlert && styles.statCardAlert]}
      onPress={card.onPress}
      activeOpacity={0.7}
    >
      {showAlert ? <View style={styles.statAlertDot} /> : null}
      <View style={[styles.statIconWrap, { backgroundColor: card.iconBg }]}>
        <AdminScreenIcon name={card.icon} size={24} color={card.iconColor} webGlyph={card.webGlyph} />
      </View>
      <Text style={styles.statNumber}>{card.value}</Text>
      <Text style={styles.statLabel}>{card.label}</Text>
    </TouchableOpacity>
  );
}

export function AdminStatGrid({ cards }: AdminStatGridProps) {
  return (
    <View style={styles.statsSection}>
      <Text style={styles.statsTitle}>ملخص الإحصائيات</Text>
      <View style={styles.statsGrid}>
        {cards.map((card) => (
          <StatCard key={card.label} card={card} />
        ))}
      </View>
    </View>
  );
}
