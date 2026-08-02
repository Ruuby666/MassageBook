import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

// A single floating button that expands upward into a stack of labeled
// actions (speed-dial pattern), instead of several always-visible FABs
// competing for space in the corner.
export default function ExpandableFabMenu({ actions }) {
  const [expanded, setExpanded] = useState(false);

  function handleActionPress(action) {
    setExpanded(false);
    action.onPress();
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {expanded &&
        actions.map((action) => (
          <View key={action.key} style={styles.actionRow}>
            <Text style={styles.actionLabel}>{action.label}</Text>
            <Pressable
              style={styles.actionButton}
              onPress={() => handleActionPress(action)}
              hitSlop={8}
              testID={action.testID}
            >
              <Ionicons name={action.icon} size={20} color={colors.surface} />
            </Pressable>
          </View>
        ))}

      <Pressable
        style={styles.mainButton}
        onPress={() => setExpanded(!expanded)}
        hitSlop={8}
        testID="fab-menu-toggle"
      >
        <Ionicons name={expanded ? 'close' : 'add'} size={26} color={colors.surface} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    flexDirection: 'column-reverse',
    alignItems: 'flex-end',
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionLabel: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: typography.cardMeta,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
