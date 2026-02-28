import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Animated,
  PanResponder,
  Pressable,
} from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  Chip,
  useTheme,
  Divider,
  FAB,
  Searchbar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { getGlowStyle } from '../utils/glowColor';
import type { Task, SubTask, RootStackParamList } from '../types';

function SubTaskItem({ subTask }: { subTask: SubTask }) {
  const theme = useTheme();
  return (
    <View style={styles.subTaskRow}>
      <MaterialCommunityIcons
        name={subTask.completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
        size={18}
        color={subTask.completed ? theme.colors.primary : theme.colors.outline}
      />
      <Text
        variant="bodySmall"
        style={[
          styles.subTaskText,
          {
            color: theme.colors.onSurface,
            textDecorationLine: subTask.completed ? 'line-through' : 'none',
            opacity: subTask.completed ? 0.5 : 1,
          },
        ]}
      >
        {subTask.title}
      </Text>
    </View>
  );
}

function TaskItem({
  task,
  onToggle,
  onDelete,
  onAiRefine,
  onNavigate,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onAiRefine: () => void;
  onNavigate: () => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 20,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -100));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -80) {
          // Swiped far enough to complete
          Animated.timing(translateX, {
            toValue: -400,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            onToggle();
            translateX.setValue(0);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const priorityColor = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#10B981',
  }[task.priority];

  return (
    <View style={styles.taskItemWrapper}>
      {/* Swipe background */}
      <View style={[styles.swipeBackground, { backgroundColor: '#10B981' }]}>
        <MaterialCommunityIcons name="check" size={24} color="#FFFFFF" />
        <Text style={styles.swipeText}>完了</Text>
      </View>

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {(function () {
          var glow = getGlowStyle(task);
          return (
        <Surface
          style={[
            styles.taskCard,
            {
              backgroundColor: theme.colors.surface,
              opacity: task.completed ? 0.5 : 1,
              shadowColor: glow.shadowColor,
              shadowOpacity: glow.shadowOpacity,
              shadowRadius: glow.shadowRadius,
              shadowOffset: { width: 0, height: 2 },
            },
          ]}
          elevation={1}
        >
          {/* Glow color bar */}
          <View style={[styles.glowBar, { backgroundColor: glow.color }]} />
          <Pressable onPress={onNavigate}>
            <View style={styles.taskHeader}>
              <IconButton
                icon={task.completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                size={24}
                iconColor={task.completed ? theme.colors.primary : theme.colors.outline}
                onPress={onToggle}
                style={styles.checkButton}
              />
              <View style={styles.taskInfo}>
                <Text
                  variant="titleMedium"
                  style={[
                    {
                      color: theme.colors.onSurface,
                      textDecorationLine: task.completed ? 'line-through' : 'none',
                    },
                  ]}
                >
                  {task.title}
                </Text>
                <View style={styles.taskMeta}>
                  <Chip
                    compact
                    style={[styles.priorityChip, { backgroundColor: priorityColor + '20' }]}
                    textStyle={{ fontSize: 10, color: priorityColor }}
                  >
                    {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                  </Chip>
                  {task.isRecurring && (
                    <Chip
                      compact
                      icon="repeat"
                      style={[styles.recurChip, { backgroundColor: theme.colors.primaryContainer }]}
                      textStyle={{ fontSize: 10, color: theme.colors.primary }}
                    >
                      {task.recurringPattern === 'daily'
                        ? '毎日'
                        : task.recurringPattern === 'weekly'
                        ? '毎週'
                        : '毎月'}
                    </Chip>
                  )}
                  {task.dueDate && (
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginLeft: 8 }}>
                      {task.dueDate}
                    </Text>
                  )}
                </View>
              </View>
              <IconButton
                icon="auto-fix"
                size={20}
                iconColor={theme.colors.secondary}
                onPress={onAiRefine}
                style={styles.aiButton}
              />
            </View>
          </Pressable>

          {/* Subtasks */}
          {expanded && task.subTasks.length > 0 && (
            <View style={styles.subTaskContainer}>
              <Divider style={{ marginBottom: 8 }} />
              {task.subTasks.map(st => (
                <SubTaskItem key={st.id} subTask={st} />
              ))}
            </View>
          )}

          {/* Expand indicator for items with subtasks */}
          {task.subTasks.length > 0 && (
            <Pressable onPress={() => setExpanded(!expanded)}>
            <View style={styles.expandHint}>
              <MaterialCommunityIcons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.outline}
              />
              <Text variant="labelSmall" style={{ color: theme.colors.outline, marginLeft: 2 }}>
                サブタスク {task.subTasks.filter(s => s.completed).length}/{task.subTasks.length}
              </Text>
            </View>
            </Pressable>
          )}
        </Surface>
          );
        })()}
      </Animated.View>
    </View>
  );
}

export default function TaskListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { tasks, toggleTask, deleteTask } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [aiRefineMessage, setAiRefineMessage] = useState<string | null>(null);

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === 'all' ? true : filter === 'active' ? !t.completed : t.completed;
    return matchesSearch && matchesFilter;
  });

  const handleAiRefine = (task: Task) => {
    const messages = [
      `「${task.title}」を分析しました。\n\n提案：\n1. まずは15分だけ取り組んでみましょう\n2. 関連資料を先に集めると効率的です\n3. 完了の定義を明確にしましょう`,
      `「${task.title}」を精査しました。\n\nサブタスクを追加提案：\n・リサーチ（20分）\n・ドラフト作成（30分）\n・レビュー依頼（5分）`,
      `「${task.title}」の優先度を見直しました。\n\n今の状況だと、これを先にやると他のタスクもスムーズに進みそうです！`,
    ];
    setAiRefineMessage(messages[Math.floor(Math.random() * messages.length)]);
    setTimeout(() => setAiRefineMessage(null), 4000);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onBackground }]}>
          タスク
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
          {tasks.filter(t => !t.completed).length}件の未完了
        </Text>
      </View>

      {/* Search */}
      <Searchbar
        placeholder="タスクを検索..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant }]}
        inputStyle={{ fontSize: 14 }}
      />

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'completed'] as const).map(f => (
          <Chip
            key={f}
            selected={filter === f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && { backgroundColor: theme.colors.primaryContainer }]}
            textStyle={{ fontSize: 12 }}
          >
            {f === 'all' ? 'すべて' : f === 'active' ? '未完了' : '完了済み'}
          </Chip>
        ))}
      </View>

      {/* AI Refine toast */}
      {aiRefineMessage && (
        <Surface style={[styles.aiToast, { backgroundColor: theme.colors.secondaryContainer }]} elevation={3}>
          <MaterialCommunityIcons name="auto-fix" size={20} color={theme.colors.secondary} />
          <Text variant="bodySmall" style={{ flex: 1, marginLeft: 8, color: theme.colors.onSurface }}>
            {aiRefineMessage}
          </Text>
        </Surface>
      )}

      {/* Task list */}
      <FlatList
        data={filteredTasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            onToggle={() => toggleTask(item.id)}
            onDelete={() => deleteTask(item.id)}
            onAiRefine={() => handleAiRefine(item)}
            onNavigate={() => navigation.navigate('TaskDetail', { taskId: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={64}
              color={theme.colors.outline}
            />
            <Text variant="bodyLarge" style={{ color: theme.colors.outline, marginTop: 16 }}>
              タスクがありません
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontWeight: '700',
  },
  searchbar: {
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 0,
    height: 44,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  filterChip: {
    borderRadius: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  taskItemWrapper: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  swipeBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 24,
    borderRadius: 16,
  },
  swipeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  taskCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  glowBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  checkButton: {
    margin: 0,
  },
  taskInfo: {
    flex: 1,
    paddingVertical: 12,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  priorityChip: {
    height: 22,
    borderRadius: 6,
  },
  recurChip: {
    height: 22,
    borderRadius: 6,
    marginLeft: 6,
  },
  aiButton: {
    margin: 0,
  },
  subTaskContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  subTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: 8,
  },
  subTaskText: {
    marginLeft: 8,
  },
  expandHint: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  aiToast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
  },
});
