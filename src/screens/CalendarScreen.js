import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppointmentCard from '../components/AppointmentCard';
import AppointmentDetailModal from '../components/AppointmentDetailModal';
import AppointmentModal from '../components/AppointmentModal';
import BlockCard from '../components/BlockCard';
import BlockModal from '../components/BlockModal';
import FloatingActionButton from '../components/FloatingActionButton';
import { db, functions } from '../firebase';
import { colors, spacing } from '../theme';
import { isSameDay, timeStringToDate, toDateKey } from '../utils/dateHelpers';

const calendarTheme = {
  backgroundColor: colors.background,
  calendarBackground: colors.background,
  textSectionTitleColor: colors.textSecondary,
  selectedDayBackgroundColor: colors.accent,
  selectedDayTextColor: colors.surface,
  todayTextColor: colors.accent,
  dayTextColor: colors.textPrimary,
  textDisabledColor: colors.border,
  monthTextColor: colors.textPrimary,
  arrowColor: colors.accent,
  textDayFontWeight: '500',
  textMonthFontWeight: '700',
  textDayHeaderFontWeight: '600',
};

const createReservation = httpsCallable(functions, 'createReservation');
const updateReservationTime = httpsCallable(functions, 'updateReservationTime');
const deleteReservation = httpsCallable(functions, 'deleteReservation');
const confirmReservation = httpsCallable(functions, 'confirmReservation');
const rejectReservation = httpsCallable(functions, 'rejectReservation');

export default function CalendarScreen() {
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [appointments, setAppointments] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [appointmentModalVisible, setAppointmentModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

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

  const markedDates = useMemo(() => {
    const marks = {};

    appointments.forEach((appointment) => {
      const key = toDateKey(new Date(appointment.date));
      const dots = marks[key]?.dots || [];
      if (!dots.some((dot) => dot.key === 'appointment')) {
        marks[key] = { ...marks[key], dots: [...dots, { key: 'appointment', color: colors.accent }] };
      }
    });

    blocks.forEach((block) => {
      const dots = marks[block.date]?.dots || [];
      if (!dots.some((dot) => dot.key === 'block')) {
        marks[block.date] = { ...marks[block.date], dots: [...dots, { key: 'block', color: colors.blocked }] };
      }
    });

    const selectedKey = toDateKey(selectedDate);
    marks[selectedKey] = { ...marks[selectedKey], selected: true, selectedColor: colors.accent };

    return marks;
  }, [appointments, blocks, selectedDate]);

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

  async function handleEditAppointmentTime(reservationId, newDate) {
    await updateReservationTime({ reservationId, date: newDate.toISOString() });
    setSelectedAppointment(null);
  }

  async function handleDeleteAppointment(reservationId) {
    await deleteReservation({ reservationId });
  }

  async function handleConfirmReservation(reservationId) {
    await confirmReservation({ reservationId });
  }

  async function handleRejectReservation(reservationId) {
    await rejectReservation({ reservationId });
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
        <Pressable onPress={() => navigation.navigate('Masajes')} hitSlop={12}>
          <Ionicons name="pricetags-outline" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>
      <Calendar
        style={styles.calendar}
        current={toDateKey(selectedDate)}
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={(day) => setSelectedDate(new Date(`${day.dateString}T00:00:00`))}
        theme={calendarTheme}
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
        onEditTime={handleEditAppointmentTime}
        onDelete={handleDeleteAppointment}
        onConfirm={handleConfirmReservation}
        onReject={handleRejectReservation}
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
    justifyContent: 'flex-end',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  calendar: {
    paddingBottom: spacing.sm,
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
