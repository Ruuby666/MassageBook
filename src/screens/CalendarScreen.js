import { SafeAreaView, SectionList, StyleSheet, Text, View } from 'react-native';
import AppointmentCard from '../components/AppointmentCard';
import { mockAppointments } from '../data/mockAppointments';

function formatSectionTitle(isoDate) {
  const label = new Date(isoDate).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayKey(isoDate) {
  return new Date(isoDate).toDateString();
}

function buildSections(appointments) {
  const now = new Date();

  const upcoming = appointments
    .filter((appointment) => new Date(appointment.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const sectionsByDay = [];
  const dayIndex = new Map();

  upcoming.forEach((appointment) => {
    const key = dayKey(appointment.date);
    if (!dayIndex.has(key)) {
      dayIndex.set(key, sectionsByDay.length);
      sectionsByDay.push({ title: formatSectionTitle(appointment.date), data: [] });
    }
    sectionsByDay[dayIndex.get(key)].data.push(appointment);
  });

  return sectionsByDay;
}

export default function CalendarScreen() {
  const sections = buildSections(mockAppointments);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Próximas citas</Text>
      {sections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No tienes citas próximas</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AppointmentCard appointment={item} />}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionHeader: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#2d6a5f',
    textTransform: 'capitalize',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
  },
});
