import * as Haptics from 'expo-haptics';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, daySelector, typography } from '../theme';
import { formatDayLabel, isSameDay } from '../utils/dateHelpers';

export default function DaySelector({ days, selectedDate, onSelectDate, daysWithAppointments }) {
  return (
    <FlatList
      horizontal
      data={days}
      keyExtractor={(day) => day.toISOString()}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item: day }) => {
        const selected = isSameDay(day, selectedDate);
        const hasAppointments = daysWithAppointments.has(day.toDateString());

        return (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectDate(day);
            }}
            style={styles.chipWrapper}
          >
            <Text style={styles.dayLabel}>{formatDayLabel(day)}</Text>
            <View style={[styles.chip, selected && styles.chipSelected]}>
              <Text style={[styles.dateNumber, selected && styles.dateNumberSelected]}>
                {day.getDate()}
              </Text>
            </View>
            <View style={[styles.dot, hasAppointments && styles.dotVisible]} />
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
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 6,
    backgroundColor: 'transparent',
  },
  dotVisible: {
    backgroundColor: colors.accent,
  },
});
