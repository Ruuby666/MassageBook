import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

function toEditableState(service) {
  return {
    name: service?.name || '',
    description: service?.description || '',
    durationMinutes: service ? String(service.durationMinutes ?? '') : '',
    price: service ? String(service.price ?? '') : '',
    materials: service?.materials || '',
    enabled: service ? Boolean(service.enabled) : true,
  };
}

export default function ServiceFormModal({ visible, service, onClose, onConfirm, onDelete }) {
  const [form, setForm] = useState(toEditableState(service));
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(service);

  useEffect(() => {
    if (visible) setForm(toEditableState(service));
  }, [visible, service]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleConfirm() {
    const name = form.name.trim();
    const price = Number(form.price);
    const durationMinutes = Number(form.durationMinutes);

    if (!name) {
      Alert.alert('Falta el nombre', 'Ponle un nombre al masaje.');
      return;
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      Alert.alert('Duración inválida', 'Ingresa la duración en minutos (un número mayor a cero).');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert('Precio inválido', 'Ingresa un precio mayor a cero.');
      return;
    }

    setSaving(true);
    try {
      await onConfirm({
        name,
        description: form.description.trim(),
        durationMinutes,
        price,
        materials: form.materials.trim(),
        enabled: form.enabled,
      });
    } catch (error) {
      Alert.alert('No se pudo guardar', error.message || 'Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert('Eliminar masaje', `¿Eliminar "${service.name}" del catálogo?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await onDelete(service.id);
          } catch (error) {
            Alert.alert('No se pudo eliminar', error.message || 'Intenta de nuevo.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{isEditing ? 'Editar masaje' : 'Nuevo masaje'}</Text>

          <TextInput
            style={styles.input}
            placeholder="Nombre (ej. Masaje relajante)"
            placeholderTextColor={colors.textSecondary}
            value={form.name}
            onChangeText={(value) => update('name', value)}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Descripción"
            placeholderTextColor={colors.textSecondary}
            multiline
            value={form.description}
            onChangeText={(value) => update('description', value)}
          />

          <TextInput
            style={styles.input}
            placeholder="Duración (minutos)"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={form.durationMinutes}
            onChangeText={(value) => update('durationMinutes', value)}
          />

          <TextInput
            style={styles.input}
            placeholder="Precio (EUR)"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={form.price}
            onChangeText={(value) => update('price', value)}
          />
          <TextInput
            style={styles.input}
            placeholder="Qué se utiliza (ej. Aceite esencial, piedras calientes)"
            placeholderTextColor={colors.textSecondary}
            value={form.materials}
            onChangeText={(value) => update('materials', value)}
          />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Disponible para que los clientes lo elijan</Text>
            <Switch
              value={form.enabled}
              onValueChange={(value) => update('enabled', value)}
              trackColor={{ true: colors.accent }}
            />
          </View>

          <View style={styles.actions}>
            {isEditing && (
              <Pressable style={[styles.button, styles.deleteButton]} onPress={handleDelete} disabled={saving}>
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </Pressable>
            )}
            <View style={styles.actionsRight}>
              <Pressable style={[styles.button, styles.cancelButton]} onPress={handleClose} disabled={saving}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.confirmButton, saving && styles.buttonDisabled]}
                onPress={handleConfirm}
                disabled={saving}
              >
                <Text style={styles.confirmButtonText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  sheetContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.cardTitle,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: typography.cardBody,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  rowLabel: {
    flex: 1,
    fontSize: typography.cardBody,
    color: colors.textPrimary,
    marginRight: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsRight: {
    flexDirection: 'row',
  },
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    marginLeft: spacing.sm,
  },
  cancelButton: {
    backgroundColor: colors.background,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: colors.blockedSurface,
    marginLeft: 0,
  },
  deleteButtonText: {
    color: colors.blocked,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: colors.accent,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: colors.surface,
    fontWeight: '600',
  },
});