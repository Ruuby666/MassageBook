import { StyleSheet, Text, View } from 'react-native';

function formatTime(isoDate) {
  return new Date(isoDate).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AppointmentCard({ appointment }) {
  const { clientName, phone, address, service, durationMinutes, date, notes } = appointment;

  return (
    <View style={styles.card}>
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{formatTime(date)}</Text>
        <Text style={styles.duration}>{durationMinutes} min</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.clientName}>{clientName}</Text>
        <Text style={styles.service}>{service}</Text>
        <Text style={styles.address}>{address}</Text>
        <Text style={styles.phone}>{phone}</Text>
        {notes ? <Text style={styles.notes}>{notes}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  timeColumn: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    marginRight: 12,
  },
  time: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2d6a5f',
  },
  duration: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  details: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  service: {
    fontSize: 14,
    color: '#2d6a5f',
    marginTop: 2,
  },
  address: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
  },
  phone: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },
  notes: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
