import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppointmentCard from '../components/AppointmentCard';
import AppointmentDetailModal from '../components/AppointmentDetailModal';
import AppointmentModal from '../components/AppointmentModal';
import BlockCard from '../components/BlockCard';
import BlockModal from '../components/BlockModal';
import DaySelector from '../components/DaySelector';
import FloatingActionButton from '../components/FloatingActionButton';
import { db, functions } from '../firebase';
import { colors, spacing, typography } from '../theme';
import {
  buildDayWindow,
  formatMonthYear,
  isSameDay,
  timeStringToDate,
  toDateKey,
} from '../utils/dateHelpers';

const createReservation = httpsCallable(functions, 'createReservation');

export default function CalendarScreen() {
  const navigation = useNavigation();
  const days = useMemo(() => buildDayWindow(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [appointments, setAppointments] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [appointmentModalVisible, setAppointmentModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const appointmentsQuery = useMemo(() => query(collection(db, 'reservations'), orderBy('date')), []);
  const blocksQuery = useMemo(() => collection(db, 'blocks'), []);
  const servicesQuery = useMemo(() => query(collection(db, 'services'), orderBy('name')), []);

  function toAppointments(snapshot) {
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return { id: docSnap.id, ...data, date: data.date.toDate() };
    });
  }

  function toDocs(snapshot) {
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  }

  useEffect(() => {
    const unsubscribeAppointments = onSnapshot(
      appointmentsQuery,
      (snapshot) => {
        setAppointments(toAppointments(snapshot));
        setLoading(false);
      },
      (error) => {
        Alert.alert('Error', 'No se pudieron cargar las citas: ' + error.message);
        setLoading(false);
      }
    );

    const unsubscribeBlocks = onSnapshot(
      blocksQuery,
      (snapshot) => setBlocks(toDocs(snapshot)),
      (error) => {
        Alert.alert('Error', 'No se pudieron cargar los bloqueos: ' + error.message);
      }
    );

    const unsubscribeServices = onSnapshot(
      servicesQuery,
      (snapshot) => setServices(toDocs(snapshot)),
      (error) => {
        Alert.alert('Error', 'No se pudieron cargar los masajes: ' + error.message);
      }
    );

    return () => {
      unsubscribeAppointments();
      unsubscribeBlocks();
      unsubscribeServices();
    };
  }, [appointmentsQuery, blocksQuery, servicesQuery]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const [appointmentsSnap, blocksSnap, servicesSnap] = await Promise.all([
        getDocs(appointmentsQuery),
        getDocs(blocksQuery),
        getDocs(servicesQuery),
      ]);
      setAppointments(toAppointments(appointmentsSnap));
      setBlocks(toDocs(blocksSnap));
      setServices(toDocs(servicesSnap));
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  }

  const daysWithAppointments = useMemo(() => {
    const set = new Set();
    appointments.forEach((appointment) => {
      set.add(new Date(appointment.date).toDateString());
    });
    return set;
  }, [appointments]);

  const blockedDays = useMemo(() => {
    const set = new Set();
    blocks.forEach((block) => {
      set.add(new Date(`${block.date}T00:00:00`).toDateString());
    });
    return set;
  }, [blocks]);

  const fullyBlockedDays = useMemo(() => {
    const set = new Set();
    blocks
      .filter((block) => block.allDay)
      .forEach((block) => set.add(new Date(`${block.date}T00:00:00`).toDateString()));
    return set;
  }, [blocks]);

  const appointmentsForSelectedDay = useMemo(() => {
    return appointments.filter((appointment) => isSameDay(new Date(appointment.date), selectedDate));
  }, [appointments, selectedDate]);

  const itemsForSelectedDay = useMemo(() => {
    const dateKey = toDateKey(selectedDate);

    const dayAppointments = appointmentsForSelectedDay.map((appointment) => ({
      type: 'appointment',
      sortKey: new Date(appointment.date).getTime(),
      data: appointment,
    }));

    const dayBlocks = blocks
      .filter((block) => block.date === dateKey)
      .map((block) => ({
        type: 'block',
        sortKey: block.allDay ? -1 : timeStringToDate(selectedDate, block.startTime).getTime(),
        data: block,
      }));

    return [...dayAppointments, ...dayBlocks].sort((a, b) => a.sortKey - b.sortKey);
  }, [selectedDate, appointmentsForSelectedDay, blocks]);

  async function handleConfirmBlock(blockData) {
    await addDoc(collection(db, 'blocks'), {
      date: toDateKey(selectedDate),
      ...blockData,
      createdAt: serverTimestamp(),
    });
    setBlockModalVisible(false);
  }

  async function handleDeleteBlock(id) {
    try {
      await deleteDoc(doc(db, 'blocks', id));
    } catch (error) {
      Alert.alert('No se pudo eliminar', error.message);
    }
  }

  async function handleConfirmAppointment({ startTime, ...appointmentData }) {
    await createReservation({
      ...appointmentData,
      date: timeStringToDate(selectedDate, startTime).toISOString(),
    });
    setAppointmentModalVisible(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>{formatMonthYear(selectedDate)}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={handleRefresh} disabled={refreshing} hitSlop={12}>
            {refreshing ? (
              <ActivityIndicator color={colors.textPrimary} size="small" />
            ) : (
              <Ionicons name="reload-outline" size={22} color={colors.textPrimary} />
            )}
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Masajes')} hitSlop={12}>
            <Ionicons name="pricetags-outline" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>
      <DaySelector
        days={days}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        daysWithAppointments={daysWithAppointments}
        blockedDays={blockedDays}
        fullyBlockedDays={fullyBlockedDays}
      />
      <FlatList
        data={itemsForSelectedDay}
        keyExtractor={(item) => item.data.id}
        renderItem={({ item }) =>
          item.type === 'appointment' ? (
            <AppointmentCard appointment={item.data} onPress={setSelectedAppointment} />
          ) : (
            <BlockCard block={item.data} onDelete={handleDeleteBlock} />
          )
        }
        contentContainerStyle={
          itemsForSelectedDay.length === 0 ? styles.emptyListContent : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No tienes citas ni bloqueos este día</Text>
          </View>
        }
      />

      <FloatingActionButton
        icon="add"
        bottomOffset={96}
        onPress={() => setAppointmentModalVisible(true)}
      />
      <FloatingActionButton
        icon="lock-closed"
        bottomOffset={28}
        onPress={() => setBlockModalVisible(true)}
      />

      <AppointmentModal
        visible={appointmentModalVisible}
        date={selectedDate}
        services={services}
        existingAppointments={appointmentsForSelectedDay}
        onClose={() => setAppointmentModalVisible(false)}
        onConfirm={handleConfirmAppointment}
      />

      <BlockModal
        visible={blockModalVisible}
        date={selectedDate}
        onClose={() => setBlockModalVisible(false)}
        onConfirm={handleConfirmBlock}
      />

      <AppointmentDetailModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    fontSize: typography.header,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + 128,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});
