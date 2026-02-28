import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  TextInput,
  Chip,
  Switch,
  Button,
  useTheme,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList, Task, AiReviewResult, SubTask, PortfolioType } from '../types';
import { useApp } from '../context/AppContext';
import { getGlowStyle } from '../utils/glowColor';
import { generateId } from '../db/database';

// ---------------------------------------------------------------------------
// Bar animation component for "mixing console" view
// ---------------------------------------------------------------------------

function AnimatedBar({
  score,
  label,
  color,
  duration,
}: {
  score: number;
  label: string;
  color: string;
  duration: number;
}) {
  var theme = useTheme();
  var barWidth = useSharedValue(0);
  var scanX = useSharedValue(-50);

  useEffect(function () {
    barWidth.value = withTiming(score, {
      duration: duration,
      easing: Easing.out(Easing.cubic),
    });
    scanX.value = withRepeat(
      withSequence(
        withTiming(110, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(-10, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [score, duration]);

  var barStyle = useAnimatedStyle(function () {
    return {
      width: (barWidth.value.toString() + '%') as any,
    };
  });

  var scanStyle = useAnimatedStyle(function () {
    return {
      left: (scanX.value.toString() + '%') as any,
    };
  });

  return (
    <View style={barStyles.container}>
      <View style={barStyles.labelRow}>
        <Text style={[barStyles.label, { color: theme.colors.onSurface }]}>{label}</Text>
        <Text style={[barStyles.score, { color: color }]}>{score}</Text>
      </View>
      <View style={[barStyles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Animated.View style={[barStyles.fill, { backgroundColor: color }, barStyle]} />
        <Animated.View style={[barStyles.scan, scanStyle]} />
      </View>
    </View>
  );
}

var barStyles = StyleSheet.create({
  container: { marginBottom: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '500' },
  score: { fontSize: 13, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', position: 'relative' },
  fill: { height: '100%', borderRadius: 4 },
  scan: { position: 'absolute', top: 0, width: 20, height: '100%', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4 },
});

// ---------------------------------------------------------------------------
// TaskDetailScreen
// ---------------------------------------------------------------------------

export default function TaskDetailScreen() {
  var theme = useTheme();
  var navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  var route = useRoute<RouteProp<RootStackParamList, 'TaskDetail'>>();
  var taskId = route.params.taskId;

  var {
    tasks,
    personality,
    categories,
    superGoals,
    insightVisualizationStyle,
    setInsightVisualizationStyle,
    deleteTask,
    toggleSubTask,
    deleteSubTask,
    addSubTasksToTask,
    updateTaskTitle,
    updateTaskDueDate,
    updateTaskCategory,
    updateTaskPortfolioType,
    toggleTaskSanctuary,
    updateTaskSuperGoalId,
  } = useApp();

  var task = tasks.find(function (t) { return t.id === taskId; });

  // Local edit state
  var [editTitle, setEditTitle] = useState(task ? task.title : '');
  var [editDueDate, setEditDueDate] = useState(task ? (task.dueDate || '') : '');

  // Sync local state if task changes
  useEffect(function () {
    if (task) {
      setEditTitle(task.title);
      setEditDueDate(task.dueDate || '');
    }
  }, [task ? task.title : '', task ? task.dueDate : '']);

  if (!task) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} onPress={function () { navigation.goBack(); }} />
          <Text variant="titleMedium">タスクが見つかりません</Text>
          <View style={{ width: 48 }} />
        </View>
      </SafeAreaView>
    );
  }

  var glowStyle = getGlowStyle(task);
  var review: AiReviewResult | null = null;
  if (task.aiReviewCache) {
    try {
      review = JSON.parse(task.aiReviewCache);
    } catch {}
  }

  // Personality-based values
  var borderRadius = personality === 'yuru' ? 22 : personality === 'maji' ? 10 : 14;
  var animDuration = personality === 'yuru' ? 2400 : personality === 'maji' ? 1500 : 2000;

  // Score to color helper
  var scoreToColor = function (score: number): string {
    if (score >= 80) return '#22C55E';
    if (score >= 40) return '#F97316';
    return '#EF4444';
  };

  var scoreToBackground = function (score: number): string {
    if (score >= 80) return '#22C55E18';
    if (score >= 40) return '#F9731618';
    return '#EF444418';
  };

  // Active super goals for Drive selection
  var activeSuperGoals = superGoals.filter(function (g) { return g.status === 'active'; });

  // Suggested subtasks from AI review
  var suggestedSubTasks: string[] = [];
  if (review && review.decomposition && review.decomposition.suggestedSubTasks) {
    var existingTitles = task.subTasks.map(function (s) { return s.title; });
    suggestedSubTasks = review.decomposition.suggestedSubTasks.filter(function (title) {
      return existingTitles.indexOf(title) === -1;
    });
  }

  // Handlers
  var handleDelete = function () {
    Alert.alert('タスクを削除', '本当にこのタスクを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: function () {
          deleteTask(taskId);
          navigation.goBack();
        },
      },
    ]);
  };

  var handleTitleBlur = function () {
    var trimmed = editTitle.trim();
    if (trimmed && trimmed !== task!.title) {
      updateTaskTitle(taskId, trimmed);
    }
  };

  var handleDueDateBlur = function () {
    var trimmed = editDueDate.trim();
    if (trimmed !== (task!.dueDate || '')) {
      updateTaskDueDate(taskId, trimmed || null);
    }
  };

  var handlePortfolioChange = function (type: PortfolioType) {
    if (personality === 'maji' && task!.portfolioType === 'drive' && type !== 'drive') {
      Alert.alert('確認', '目標達成への影響を確認しましたか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '変更する', onPress: function () { updateTaskPortfolioType(taskId, type); } },
      ]);
    } else {
      updateTaskPortfolioType(taskId, type);
    }
  };

  var handleAddAllSuggestions = function () {
    var newSubs: SubTask[] = suggestedSubTasks.map(function (title) {
      return { id: generateId(), title: title, completed: false };
    });
    addSubTasksToTask(taskId, newSubs);
  };

  // Insight perspective icons & labels
  var perspectives = [
    { key: 'necessity' as const, icon: 'target' as const, label: '必要性' },
    { key: 'feasibility' as const, icon: 'gauge' as const, label: '実現可能性' },
    { key: 'decomposition' as const, icon: 'puzzle-outline' as const, label: '分解' },
    { key: 'efficiency' as const, icon: 'lightning-bolt-outline' as const, label: '効率' },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={function () { navigation.goBack(); }}
          iconColor={theme.colors.onBackground}
        />
        <Text variant="titleMedium" style={{ color: theme.colors.onBackground, fontWeight: '600' }}>
          タスク詳細
        </Text>
        <IconButton
          icon="delete-outline"
          size={24}
          onPress={handleDelete}
          iconColor={theme.colors.error}
        />
      </View>

      {/* Glow accent bar */}
      <View style={[styles.accentBar, { backgroundColor: glowStyle.color }]} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── Section A: AITAS Insight ─── */}
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            AITAS インサイト
          </Text>
          <IconButton
            icon={insightVisualizationStyle === 'tiles' ? 'tune-variant' : 'view-dashboard-outline'}
            size={20}
            onPress={function () {
              setInsightVisualizationStyle(insightVisualizationStyle === 'tiles' ? 'bars' : 'tiles');
            }}
            iconColor={theme.colors.primary}
          />
        </View>

        {/* Sanctuary banner */}
        {task.isSanctuary && review && review.isSanctuary && (
          <Surface style={[styles.sanctuaryBanner, { backgroundColor: '#F59E0B18', borderRadius: borderRadius }]} elevation={1}>
            <Text style={styles.sanctuaryEmoji}>{'✨'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sanctuaryTitle, { color: '#F59E0B' }]}>Sanctuary Mode</Text>
              {review.sanctuaryMessage && (
                <Text style={[styles.sanctuaryMsg, { color: theme.colors.onSurface }]}>
                  {review.sanctuaryMessage}
                </Text>
              )}
            </View>
          </Surface>
        )}

        {review && !review.isSanctuary ? (
          insightVisualizationStyle === 'tiles' ? (
            /* Tile view (2x2 grid) */
            <View style={styles.tileGrid}>
              {perspectives.map(function (p) {
                var perspective = (review as AiReviewResult)[p.key];
                var score = perspective.score;
                return (
                  <Surface
                    key={p.key}
                    style={[
                      styles.tile,
                      {
                        backgroundColor: scoreToBackground(score),
                        borderRadius: borderRadius,
                      },
                    ]}
                    elevation={1}
                  >
                    <MaterialCommunityIcons
                      name={p.icon as any}
                      size={24}
                      color={scoreToColor(score)}
                    />
                    <Text style={[styles.tileScore, { color: scoreToColor(score) }]}>{score}</Text>
                    <Text style={[styles.tileLabel, { color: theme.colors.onSurface }]}>{p.label}</Text>
                    <Text style={[styles.tileSummary, { color: theme.colors.onSurface }]} numberOfLines={2}>
                      {perspective.summary}
                    </Text>
                  </Surface>
                );
              })}
            </View>
          ) : (
            /* Bar view (mixing console) */
            <Surface style={[styles.barContainer, { backgroundColor: theme.colors.surface, borderRadius: borderRadius }]} elevation={1}>
              {perspectives.map(function (p) {
                var perspective = (review as AiReviewResult)[p.key];
                return (
                  <AnimatedBar
                    key={p.key}
                    score={perspective.score}
                    label={p.label}
                    color={scoreToColor(perspective.score)}
                    duration={animDuration}
                  />
                );
              })}
              <Divider style={{ marginVertical: 8 }} />
              <View style={barStyles.labelRow}>
                <Text style={[barStyles.label, { color: theme.colors.onSurface, fontWeight: '700' }]}>
                  総合スコア
                </Text>
                <Text style={[barStyles.score, { color: scoreToColor(review.overallScore) }]}>
                  {review.overallScore}
                </Text>
              </View>
            </Surface>
          )
        ) : !review ? (
          <Surface style={[styles.noInsight, { backgroundColor: theme.colors.surfaceVariant, borderRadius: borderRadius }]} elevation={1}>
            <MaterialCommunityIcons name="robot-confused-outline" size={32} color={theme.colors.outline} />
            <Text style={{ color: theme.colors.outline, marginTop: 8 }}>
              {task.inferenceStatus === 'pending' ? 'AI分析中...' : 'インサイトデータなし'}
            </Text>
          </Surface>
        ) : null}

        <Divider style={styles.divider} />

        {/* ─── Section B: Portfolio & Goal ─── */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          ポートフォリオ & ゴール
        </Text>

        <View style={styles.chipRow}>
          {([
            { type: 'drive' as const, label: 'ドライブ', emoji: '\uD83D\uDE80' },
            { type: 'maintenance' as const, label: 'メンテナンス', emoji: '\uD83D\uDD27' },
            { type: 'recharge' as const, label: 'リチャージ', emoji: '\uD83D\uDD0B' },
          ]).map(function (item) {
            var selected = task!.portfolioType === item.type;
            return (
              <Chip
                key={item.type}
                selected={selected}
                onPress={function () { handlePortfolioChange(item.type); }}
                style={[styles.portfolioChip, selected && { backgroundColor: theme.colors.primaryContainer }]}
                textStyle={{ fontSize: 13 }}
              >
                {item.emoji + ' ' + item.label}
              </Chip>
            );
          })}
        </View>

        {/* SuperGoal selection (Drive only) */}
        {task.portfolioType === 'drive' && activeSuperGoals.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.goalScroll}>
            {activeSuperGoals.map(function (goal) {
              var selected = task!.superGoalId === goal.id;
              return (
                <Chip
                  key={goal.id}
                  selected={selected}
                  onPress={function () {
                    updateTaskSuperGoalId(taskId, selected ? null : goal.id);
                  }}
                  style={[styles.goalChip, selected && { backgroundColor: theme.colors.primaryContainer }]}
                  textStyle={{ fontSize: 12 }}
                  compact
                >
                  {goal.title}
                </Chip>
              );
            })}
          </ScrollView>
        )}

        {/* Sanctuary toggle */}
        <View style={styles.sanctuaryRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.onSurface, fontSize: 14 }}>
              聖域タスクとして保護
            </Text>
            {personality === 'yuru' && (
              <Text style={{ color: theme.colors.primary, fontSize: 12, marginTop: 2 }}>
                大切な時間を守ろ〜！
              </Text>
            )}
          </View>
          <Switch
            value={!!task.isSanctuary}
            onValueChange={function () { toggleTaskSanctuary(taskId); }}
            color={personality === 'yuru' ? theme.colors.primary : undefined}
          />
        </View>

        <Divider style={styles.divider} />

        {/* ─── Section C: SubTasks & AI suggestions ─── */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          サブタスク
        </Text>

        {task.subTasks.length > 0 ? (
          task.subTasks.map(function (sub) {
            return (
              <View key={sub.id} style={styles.subTaskRow}>
                <Pressable
                  style={styles.subTaskCheck}
                  onPress={function () { toggleSubTask(taskId, sub.id); }}
                >
                  <MaterialCommunityIcons
                    name={sub.completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                    size={22}
                    color={sub.completed ? theme.colors.primary : theme.colors.outline}
                  />
                  <Text
                    style={[
                      styles.subTaskTitle,
                      {
                        color: theme.colors.onSurface,
                        textDecorationLine: sub.completed ? 'line-through' : 'none',
                        opacity: sub.completed ? 0.5 : 1,
                      },
                    ]}
                  >
                    {sub.title}
                  </Text>
                </Pressable>
                <IconButton
                  icon="close"
                  size={16}
                  onPress={function () { deleteSubTask(taskId, sub.id); }}
                  iconColor={theme.colors.outline}
                  style={styles.subTaskDelete}
                />
              </View>
            );
          })
        ) : (
          <Text style={{ color: theme.colors.outline, fontSize: 13, marginBottom: 8 }}>
            サブタスクなし
          </Text>
        )}

        {/* AI suggested subtasks */}
        {suggestedSubTasks.length > 0 && (
          <Surface style={[styles.suggestionBox, { backgroundColor: theme.colors.surfaceVariant, borderRadius: borderRadius }]} elevation={1}>
            <Text style={[styles.suggestionHeader, { color: theme.colors.onSurface }]}>
              AI分解提案
            </Text>
            {suggestedSubTasks.map(function (title, index) {
              return (
                <Text key={index} style={[styles.suggestionItem, { color: theme.colors.onSurface }]}>
                  {(index + 1) + '. ' + title}
                </Text>
              );
            })}
            <Button
              mode="contained-tonal"
              onPress={handleAddAllSuggestions}
              icon="plus"
              style={{ marginTop: 8, alignSelf: 'flex-start', borderRadius: borderRadius }}
              compact
            >
              すべて追加
            </Button>
          </Surface>
        )}

        <Divider style={styles.divider} />

        {/* ─── Section D: Metadata ─── */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          メタデータ
        </Text>

        <TextInput
          mode="outlined"
          label="タイトル"
          value={editTitle}
          onChangeText={setEditTitle}
          onBlur={handleTitleBlur}
          style={styles.metaInput}
        />

        <TextInput
          mode="outlined"
          label="期限 (YYYY-MM-DD)"
          value={editDueDate}
          onChangeText={setEditDueDate}
          onBlur={handleDueDateBlur}
          style={styles.metaInput}
          placeholder="2026-03-01"
        />

        {/* Category chips */}
        {categories.length > 0 && (
          <View>
            <Text style={{ color: theme.colors.onSurface, fontSize: 13, marginBottom: 6, marginTop: 4 }}>
              カテゴリ
            </Text>
            <View style={styles.chipRow}>
              {categories.map(function (cat) {
                var selected = task!.categoryId === cat.id;
                return (
                  <Chip
                    key={cat.id}
                    selected={selected}
                    onPress={function () { updateTaskCategory(taskId, cat.id); }}
                    style={[
                      styles.categoryChip,
                      selected && { backgroundColor: cat.color + '30' },
                    ]}
                    textStyle={{ fontSize: 12, color: selected ? cat.color : theme.colors.onSurface }}
                    compact
                  >
                    {cat.name}
                  </Chip>
                );
              })}
            </View>
          </View>
        )}

        {/* Reschedule warning */}
        {task.rescheduleCount >= 1 && (
          <View style={styles.rescheduleWarning}>
            <MaterialCommunityIcons name="alert-circle" size={18} color={theme.colors.error} />
            <Text style={{ color: theme.colors.error, fontSize: 13, marginLeft: 6 }}>
              リスケ {task.rescheduleCount}回
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

var styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },
  // Sanctuary
  sanctuaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 12,
  },
  sanctuaryEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  sanctuaryTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  sanctuaryMsg: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.8,
  },
  // Tile grid
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '47%',
    padding: 14,
    alignItems: 'center',
  },
  tileScore: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  tileSummary: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
  // Bar view
  barContainer: {
    padding: 16,
  },
  // No insight
  noInsight: {
    alignItems: 'center',
    padding: 24,
  },
  // Portfolio
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  portfolioChip: {
    borderRadius: 20,
  },
  goalScroll: {
    marginBottom: 12,
  },
  goalChip: {
    marginRight: 8,
    borderRadius: 16,
  },
  sanctuaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  // SubTasks
  subTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  subTaskCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subTaskTitle: {
    marginLeft: 8,
    fontSize: 14,
  },
  subTaskDelete: {
    margin: 0,
    marginLeft: 4,
  },
  // Suggestion box
  suggestionBox: {
    padding: 14,
    marginTop: 12,
  },
  suggestionHeader: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 8,
  },
  suggestionItem: {
    fontSize: 13,
    paddingVertical: 2,
    paddingLeft: 4,
  },
  // Metadata
  metaInput: {
    marginBottom: 12,
  },
  categoryChip: {
    borderRadius: 16,
  },
  rescheduleWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
});
