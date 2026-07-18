import { Ionicons } from '@expo/vector-icons';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingActionButton from '../components/FloatingActionButton';
import ServiceFormModal from '../components/ServiceFormModal';
import { db } from '../firebase';
import { colors, spacing, typography } from '../theme';

function ServiceRow({ item, onOpen, onToggleEnabled }) {
  const swipeableRef = useRef(null);

  function handleOpen() {
    swipeableRef.current?.close();
    onOpen(item);
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={() => (
        <Pressable style={styles.swipeAction} onPress={handleOpen}>
          <Ionicons name="create-outline" size={20} color={colors.surface} />
          <Text style={styles.swipeActionText}>Editar</Text>
        </Pressable>
      )}
      onSwipeableOpen={handleOpen}
      overshootRight={false}
    >
      <Pressable style={styles.card} onPress={handleOpen}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {item.durationMinutes} min · ${item.price}
          </Text>
        </View>
        <Switch
          value={Boolean(item.enabled)}
          onValueChange={(value) => onToggleEnabled(item, value)}
          trackColor={{ true: colors.accent }}
        />
      </Pressable>
    </Swipeable>
  );
}

export default function ServicesScreen() {
  const [services, setServices] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [editingService, setEditingService] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'services'), orderBy('name')),
      (snapshot) => {
        setServices(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      },
      (error) => {
        Alert.alert('Error', 'No se pudieron cargar los masajes: ' + error.message);
      }
    );

    return unsubscribe;
  }, []);

  function openCreate() {
    setEditingService(null);
    setFormVisible(true);
  }

  function openEdit(service) {
    setEditingService(service);
    setFormVisible(true);
  }

  function closeForm() {
    setFormVisible(false);
    setEditingService(null);
  }

  async function handleSaveService(data) {
    if (editingService) {
      await updateDoc(doc(db, 'services', editingService.id), data);
    } else {
      await addDoc(collection(db, 'services'), { ...data, createdAt: serverTimestamp() });
    }
    closeForm();
  }

  async function handleDeleteService(id) {
    await deleteDoc(doc(db, 'services', id));
    closeForm();
  }

  async function handleToggleEnabled(service, value) {
    try {
      await updateDoc(doc(db, 'services', service.id), { enabled: value });
    } catch (error) {
      Alert.alert('No se pudo actualizar', error.message);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {services.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Aún no tienes masajes en tu catálogo</Text>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ServiceRow item={item} onOpen={openEdit} onToggleEnabled={handleToggleEnabled} />
          )}
        />
      )}

      <FloatingActionButton icon="add" onPress={openCreate} />

      <ServiceFormModal
        visible={formVisible}
        service={editingService}
        onClose={closeForm}
        onConfirm={handleSaveService}
        onDelete={handleDeleteService}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + 80,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  cardName: {
    fontSize: typography.cardTitle,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardMeta: {
    fontSize: typography.cardMeta,
    color: colors.textSecondary,
    marginTop: 2,
  },
  swipeAction: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: 84,
    marginVertical: spacing.xs,
    marginRight: spacing.lg,
  },
  swipeActionText: {
    color: colors.surface,
    fontSize: typography.cardMeta,
    fontWeight: '600',
    marginTop: 2,
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