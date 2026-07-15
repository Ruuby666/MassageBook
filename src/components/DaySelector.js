import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, daySelector, typography } from '../theme';
import { formatDayLabel, isSameDay } from '../utils/dateHelpers';

export default function DaySelector({
  days,
  selectedDate,
  onSelectDate,
  daysWithAppointments,
  blockedDays,
  fullyBlockedDays,
}) {
  return (
    <FlatList
      horizontal
      data={days}
      keyExtractor={(day) => day.toISOString()}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item: day }) => {
        const selected = isSameDay(day, selectedDate);
        const dayKey = day.toDateString();
        const hasAppointments = daysWithAppointments.has(dayKey);
        const hasBlock = blockedDays.has(dayKey);
        const fullyBlocked = fullyBlockedDays.has(dayKey);

        return (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectDate(day);
            }}
            style={styles.chipWrapper}
          >
            <Text style={styles.dayLabel}>{formatDayLabel(day)}</Text>
            <View style={[styles.chip, fullyBlocked && styles.chipBlocked, selected && styles.chipSelected]}>
              {fullyBlocked ? (
                <Ionicons
                  name="lock-closed"
                  size={16}
                  color={selected ? colors.surface : colors.blocked}
                />
              ) : (
                <Text style={[styles.dateNumber, selected && styles.dateNumberSelected]}>
                  {day.getDate()}
                </Text>
              )}
            </View>
            <View style={styles.dotsRow}>
              <View style={[styles.dot, hasAppointments && styles.dotAppointment]} />
              <View style={[styles.dot, hasBlock && styles.dotBlocked]} />
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipWrapper: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  dayLabel: {
    fontSize: typography.dayLabel,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  chip: {
    width: daySelector.chipSize,
    height: daySelector.chipSize,
    borderRadius: daySelector.chipRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  chipBlocked: {
    backgroundColor: colors.blockedSurface,
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
  dateNumber: {
    fontSize: typography.dateNumber,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dateNumberSelected: {
    color: colors.surface,
  },
  dotsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
    backgroundColor: 'transparent',
  },
  dotAppointment: {
    backgroundColor: colors.accent,
  },
  dotBlocked: {
    backgroundColor: colors.blocked,
  },
});
