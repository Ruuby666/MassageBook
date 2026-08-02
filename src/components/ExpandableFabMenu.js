import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

// Vertical distance between an action's resting spot and the next one,
// measured from the main button's position (where every action starts,
// hidden behind it, before sliding up into place).
const ACTION_SPACING = 72;

// A single floating button that expands upward into a stack of labeled
// actions (speed-dial pattern), instead of several always-visible FABs
// competing for space in the corner. The actions slide out from behind
// the main button and back, which is why they're always mounted and
// animated rather than conditionally rendered — the main button itself
// never moves.
export default function ExpandableFabMenu({ actions }) {
  const [expanded, setExpanded] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  function animateTo(next) {
    Animated.spring(animation, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    animateTo(next);
  }

  function handleActionPress(action) {
    setExpanded(false);
    animateTo(false);
    action.onPress();
  }

  const rotate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.container}>
      {actions.map((action, index) => {
        const offset = (index + 1) * ACTION_SPACING;
        const translateY = animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -offset],
        });

        return (
          <Animated.View
            key={action.key}
            pointerEvents={expanded ? 'auto' : 'none'}
            style={[styles.actionRow, { opacity: animation, transform: [{ translateY }] }]}
          >
            <Text style={styles.actionLabel}>{action.label}</Text>
            <Pressable
              style={styles.actionButton}
              onPress={() => handleActionPress(action)}
              hitSlop={8}
              testID={action.testID}
            >
              <Ionicons name={action.icon} size={26} color={colors.surface} />
            </Pressable>
          </Animated.View>
        );
      })}

      <Pressable
        style={styles.mainButton}
        onPress={toggle}
        hitSlop={8}
        testID="fab-menu-toggle"
        accessibilityLabel={expanded ? 'Cerrar menú' : 'Abrir menú'}
      >
        <AnimatedIonicons
          name="chevron-down"
          size={26}
          color={colors.surface}
          style={{ transform: [{ rotate }] }}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
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
    position: 'absolute',
    // Fixed width (comfortably wider than the longest label) instead of
    // letting it size to content — on native, an absolutely-positioned
    // view with only `right` set and an auto width gets its width from
    // measuring its children, and that measurement is what was landing
    // buttons at a different x per label length. A fixed width removes
    // that step: `right: 0` now has a known box to anchor to, and
    // justifyContent pins the button to this row's right edge regardless
    // of how wide its label is.
    width: 200,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
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
    width: 56,
    height: 56,
    borderRadius: 28,
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
