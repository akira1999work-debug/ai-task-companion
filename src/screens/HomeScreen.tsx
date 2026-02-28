import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import {
  Text,
  IconButton,
  TextInput,
  Surface,
  useTheme,
  Portal,
  Modal,
  Button,
  FAB,
  ProgressBar,
  Chip,
  Banner,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useApp } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, RescheduleReason } from '../types';
import { generateId } from '../db/database';
import { sendMessage } from '../services/aiProvider';
import { useSortedTasks } from '../hooks/useSortedTasks';
import { calcDisplayScore } from '../services/displayScore';
import type { Task } from '../types';
import type { TaskCategory } from '../types/onboarding';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SubTaskProgress({ task }: { task: Task }) {
  if (task.subTasks.length === 0) return null;
  var completed = task.subTasks.filter(function (s) { return s.completed; }).length;
  var total = task.subTasks.length;
  var progress = total > 0 ? completed / total : 0;

  return (
    <View style={progressStyles.container}>
      <ProgressBar progress={progress} style={progressStyles.bar} />
      <Text style={progressStyles.label}>{completed}/{total}</Text>
    </View>
  );
}

var progressStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  label: { marginLeft: 8, fontSize: 12, opacity: 0.7 },
});

// ---------------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  var theme = useTheme();
  var {
    addTask,
    personality,
    rescheduleAllTasks,
    completeTaskByVoice,
    toggleTask,
    tasks,
    chatMessages,
    aiConfig,
    activeConnection,
    setActiveConnection,
    isAiProcessing,
    setIsAiProcessing,
    isCareMode,
    categories,
  } = useApp();
  var navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  var [isRecording, setIsRecording] = useState(false);
  var [showTextInput, setShowTextInput] = useState(false);
  var [textValue, setTextValue] = useState('');
  var [aiResponse, setAiResponse] = useState<string | null>(null);
  var [showReasonModal, setShowReasonModal] = useState(false);
  var [showAllTasks, setShowAllTasks] = useState(false);
  var [skippedIds, setSkippedIds] = useState<string[]>([]);

  var fadeAnim = useRef(new Animated.Value(0)).current;

  // Sorted tasks for "Now Playing"
  var sortedTasks = useSortedTasks(tasks, categories);

  // Apply skip reordering: move skipped tasks to end
  var displayTasks = React.useMemo(function () {
    if (skippedIds.length === 0) return sortedTasks;
    var notSkipped = sortedTasks.filter(function (st) {
      return skippedIds.indexOf(st.task.id) === -1;
    });
    var skipped = sortedTasks.filter(function (st) {
      return skippedIds.indexOf(st.task.id) !== -1;
    });
    return notSkipped.concat(skipped);
  }, [sortedTasks, skippedIds]);

  var focusTask = displayTasks.length > 0 ? displayTasks[0] : null;
  var nextTasks = displayTasks.slice(1, 5);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  var handleComplete = useCallback(function () {
    if (!focusTask) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleTask(focusTask.task.id);
  }, [focusTask, toggleTask]);

  var handleSkip = useCallback(function () {
    if (!focusTask) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    var taskId = focusTask.task.id;
    setSkippedIds(function (prev) { return prev.concat([taskId]); });
  }, [focusTask]);

  var handleMicPress = function () {
    if (isRecording) {
      setIsRecording(false);
      simulateAiResponse();
    } else {
      setIsRecording(true);
      setAiResponse(null);
    }
  };

  var simulateAiResponse = async function () {
    setIsAiProcessing(true);
    var userText = '音声で追加されたタスク';

    addTask({
      id: generateId(),
      title: userText,
      completed: false,
      priority: 'medium',
      isRecurring: false,
      subTasks: [],
      createdAt: new Date().toISOString(),
      taskType: 'normal',
      rescheduleCount: 0,
    });

    try {
      var result = await sendMessage(aiConfig, personality, tasks, chatMessages, userText, 'home');
      setActiveConnection(result.source);
      setAiResponse(result.text);
    } catch {
      setAiResponse('タスクを追加しました：「' + userText + '」');
    }

    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    setIsAiProcessing(false);
  };

  var handleTextSubmit = async function () {
    if (!textValue.trim()) return;
    var trimmed = textValue.trim();
    setTextValue('');
    setShowTextInput(false);

    if (trimmed.indexOf('終わった') !== -1 || trimmed.indexOf('完了') !== -1) {
      var taskName = trimmed.replace(/終わった|完了|よ|！|!/g, '').trim();
      completeTaskByVoice(taskName);
      setAiResponse('「' + taskName + '」を完了にしました！お疲れさまです');
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      return;
    }

    addTask({
      id: generateId(),
      title: trimmed,
      completed: false,
      priority: 'medium',
      isRecurring: false,
      subTasks: [],
      createdAt: new Date().toISOString(),
      taskType: 'normal',
      rescheduleCount: 0,
    });

    setIsAiProcessing(true);
    try {
      var result = await sendMessage(aiConfig, personality, tasks, chatMessages, trimmed, 'home');
      setActiveConnection(result.source);
      setAiResponse(result.text);
    } catch {
      setAiResponse('タスクを追加しました：「' + trimmed + '」');
    }
    setIsAiProcessing(false);

    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  var handleReasonSelect = function (reason: RescheduleReason) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    rescheduleAllTasks(reason);
    setShowReasonModal(false);

    var messages: Record<string, Record<RescheduleReason, string>> = {
      standard: {
        schedule_change: '予定変更ですね。タスクを明日に移動しました。',
        rest: '今日はゆっくり休んでくださいね。ケアモードに切り替えました。',
        struggling: '無理しないでください。ケアモードで3日間サポートします。',
      },
      yuru: {
        schedule_change: '予定かわっちゃったんだね〜！明日にしとくね〜',
        rest: 'おやすみの日だね〜！ゆっくりしよ〜',
        struggling: 'つらいときもあるよね〜。3日間ゆるゆるモードにするね〜',
      },
      maji: {
        schedule_change: 'スケジュール変更を反映しました。明日に再配置済みです。',
        rest: '休息日として処理しました。ケアモード有効化。',
        struggling: '状況を了解しました。3日間のケアモードを開始します。',
      },
    };

    var msg = messages[personality][reason];
    setAiResponse(msg);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  var getGreeting = function () {
    var hour = new Date().getHours();
    if (personality === 'yuru') {
      if (hour < 12) return 'おはよ〜！きょうもいっしょにがんばろ〜';
      if (hour < 18) return 'やっほ〜！午後もファイトだよ〜';
      return 'おつかれ〜！今日もよくがんばったね〜';
    }
    if (personality === 'maji') {
      if (hour < 12) return 'おはようございます。本日のタスクです。';
      if (hour < 18) return '午後の部です。集中しましょう。';
      return 'お疲れ様です。本日の振り返りを。';
    }
    if (hour < 12) return 'おはようございます！今日のタスクです';
    if (hour < 18) return 'こんにちは！タスクを確認しましょう';
    return 'こんばんは！今日の振り返りをしましょう';
  };

  var getEmptyMessage = function () {
    if (personality === 'yuru') return '全部おわったの〜！？すごい〜！明日の準備する〜？';
    if (personality === 'maji') return '全タスク完了。明日のスケジュール確認を推奨します。';
    return 'お疲れさまです！今日やることを追加しましょう。';
  };

  var getCareBannerMessage = function () {
    if (personality === 'yuru') return 'ケアモード〜！ゆっくりでいいからね〜';
    if (personality === 'maji') return 'ケアモード稼働中。回復を優先してください';
    return 'ケアモード中 — 無理せずいきましょう';
  };

  // ---------------------------------------------------------------------------
  // All-tasks modal: dynamic font sizes
  // ---------------------------------------------------------------------------

  var getTaskStyle = function (score: number) {
    if (score >= 80) return { fontSize: 20, fontWeight: 'bold' as const, opacity: 1 };
    if (score >= 50) return { fontSize: 16, fontWeight: 'normal' as const, opacity: 1 };
    if (score >= 20) return { fontSize: 13, fontWeight: 'normal' as const, opacity: 0.7 };
    return { fontSize: 11, fontWeight: 'normal' as const, opacity: 0.5 };
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  var FADE_OPACITIES = [0.8, 0.6, 0.4, 0.2];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="titleMedium" style={[styles.greeting, { color: theme.colors.onBackground }]}>
          {getGreeting()}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {activeConnection !== 'none' && (
            <Text style={{ fontSize: 16, marginRight: 4 }}>
              {activeConnection === 'local' ? '\uD83C\uDFE0' : '\u2601\uFE0F'}
            </Text>
          )}
          <IconButton
            icon="cog"
            size={24}
            onPress={function () { navigation.navigate('Settings'); }}
            iconColor={theme.colors.onBackground}
          />
        </View>
      </View>

      {/* Care mode banner */}
      {isCareMode && (
        <Surface style={[styles.careBanner, { backgroundColor: theme.colors.secondaryContainer }]} elevation={1}>
          <MaterialCommunityIcons name="heart-outline" size={18} color={theme.colors.secondary} />
          <Text style={[styles.careBannerText, { color: theme.colors.onSurface }]}>
            {getCareBannerMessage()}
          </Text>
        </Surface>
      )}

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer}>
        {/* AI Response card */}
        {aiResponse && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Surface
              style={[styles.responseCard, { backgroundColor: theme.colors.primaryContainer }]}
              elevation={2}
            >
              <MaterialCommunityIcons
                name="robot-happy-outline"
                size={24}
                color={theme.colors.primary}
                style={styles.responseIcon}
              />
              <Text variant="bodyLarge" style={{ color: theme.colors.onBackground, flex: 1 }}>
                {aiResponse}
              </Text>
            </Surface>
          </Animated.View>
        )}

        {/* Focus Card or Empty State */}
        {focusTask ? (
          <View>
            {/* Focus card */}
            <Surface style={[styles.focusCard, { backgroundColor: theme.colors.surface }]} elevation={3}>
              {/* Category color accent bar */}
              <View style={[
                styles.accentBar,
                { backgroundColor: focusTask.category ? focusTask.category.color : theme.colors.primary },
              ]} />
              <View style={styles.focusContent}>
                {/* Category chip */}
                {focusTask.category && (
                  <Chip
                    style={[styles.categoryChip, { backgroundColor: focusTask.category.color + '20' }]}
                    textStyle={{ fontSize: 11, color: focusTask.category.color }}
                    compact
                  >
                    {focusTask.category.name}
                  </Chip>
                )}

                {/* Task title */}
                <Text variant="headlineSmall" style={[styles.focusTitle, { color: theme.colors.onSurface }]}>
                  {focusTask.task.title}
                </Text>

                {/* Sub-task progress */}
                <SubTaskProgress task={focusTask.task} />

                {/* Action buttons */}
                <View style={styles.focusActions}>
                  <Button
                    mode="contained"
                    onPress={handleComplete}
                    icon="check"
                    style={styles.completeButton}
                  >
                    完了
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={handleSkip}
                    icon="skip-next"
                    style={styles.skipButton}
                  >
                    後で
                  </Button>
                </View>
              </View>
            </Surface>

            {/* Fading next tasks */}
            {nextTasks.length > 0 && (
              <View style={styles.nextTasksList}>
                {nextTasks.map(function (st, index) {
                  var opacity = FADE_OPACITIES[index] || 0.2;
                  return (
                    <View key={st.task.id} style={[styles.nextTaskRow, { opacity: opacity }]}>
                      <Text style={[styles.nextTaskTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {st.task.title}
                      </Text>
                      <Chip compact style={styles.priorityChip} textStyle={{ fontSize: 10 }}>
                        {st.task.priority}
                      </Chip>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Show all button */}
            {displayTasks.length > 1 && (
              <Button
                mode="text"
                onPress={function () { setShowAllTasks(true); }}
                style={styles.showAllButton}
              >
                すべて見る ({displayTasks.length}件)
              </Button>
            )}
          </View>
        ) : (
          /* Empty state */
          <Surface style={[styles.emptyCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={1}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={48}
              color={theme.colors.primary}
              style={{ marginBottom: 12 }}
            />
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, textAlign: 'center' }}>
              {getEmptyMessage()}
            </Text>
          </Surface>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomActions}
      >
        {showTextInput ? (
          <View style={styles.textInputRow}>
            <TextInput
              mode="outlined"
              placeholder="テキストでタスクを入力..."
              value={textValue}
              onChangeText={setTextValue}
              onSubmitEditing={handleTextSubmit}
              style={styles.textInput}
              autoFocus
              right={<TextInput.Icon icon="send" onPress={handleTextSubmit} />}
            />
            <IconButton
              icon="close"
              size={20}
              onPress={function () { setShowTextInput(false); }}
            />
          </View>
        ) : (
          <View style={styles.actionRow}>
            <Button
              mode="contained-tonal"
              onPress={function () {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setShowReasonModal(true);
              }}
              icon="calendar-refresh"
              buttonColor={theme.colors.error}
              textColor="#FFFFFF"
              style={styles.rescheduleButton}
            >
              今日は無理！
            </Button>
            <View style={{ flex: 1 }} />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* FAB for mic / text input */}
      {!showTextInput && (
        <FAB
          icon={isRecording ? 'stop' : 'microphone'}
          style={[styles.fab, { backgroundColor: isRecording ? theme.colors.error : theme.colors.primary }]}
          color="#FFFFFF"
          onPress={handleMicPress}
          onLongPress={function () { setShowTextInput(true); }}
        />
      )}

      {/* Reason selection modal */}
      <Portal>
        <Modal
          visible={showReasonModal}
          onDismiss={function () { setShowReasonModal(false); }}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
            どうしましたか？
          </Text>

          <Pressable
            style={[styles.reasonButton, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={function () { handleReasonSelect('schedule_change'); }}
          >
            <Text style={styles.reasonEmoji}>{'🗓'}</Text>
            <View style={styles.reasonTextArea}>
              <Text style={[styles.reasonLabel, { color: theme.colors.onSurface }]}>予定が変わった</Text>
              <Text style={[styles.reasonSub, { color: theme.colors.onSurface }]}>スコア影響なし</Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.reasonButton, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={function () { handleReasonSelect('rest'); }}
          >
            <Text style={styles.reasonEmoji}>{'😴'}</Text>
            <View style={styles.reasonTextArea}>
              <Text style={[styles.reasonLabel, { color: theme.colors.onSurface }]}>今日は休みたい</Text>
              <Text style={[styles.reasonSub, { color: theme.colors.onSurface }]}>ケアモード 1日</Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.reasonButton, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={function () { handleReasonSelect('struggling'); }}
          >
            <Text style={styles.reasonEmoji}>{'😰'}</Text>
            <View style={styles.reasonTextArea}>
              <Text style={[styles.reasonLabel, { color: theme.colors.onSurface }]}>ちょっとしんどい</Text>
              <Text style={[styles.reasonSub, { color: theme.colors.onSurface }]}>ケアモード 3日</Text>
            </View>
          </Pressable>

          <Button
            mode="text"
            onPress={function () { setShowReasonModal(false); }}
            style={styles.cancelButton}
          >
            やっぱり頑張る
          </Button>
        </Modal>
      </Portal>

      {/* All tasks modal */}
      <Portal>
        <Modal
          visible={showAllTasks}
          onDismiss={function () { setShowAllTasks(false); }}
          contentContainerStyle={[styles.allTasksModal, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
            今日のタスク
          </Text>
          <ScrollView style={styles.allTasksScroll}>
            {displayTasks.map(function (st) {
              var taskStyle = getTaskStyle(st.score);
              return (
                <Pressable
                  key={st.task.id}
                  style={styles.allTaskRow}
                  onPress={function () {
                    toggleTask(st.task.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                >
                  <MaterialCommunityIcons
                    name={st.task.completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                    size={20}
                    color={st.task.completed ? theme.colors.primary : theme.colors.outline}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      { color: theme.colors.onSurface },
                      { fontSize: taskStyle.fontSize, fontWeight: taskStyle.fontWeight, opacity: taskStyle.opacity },
                      st.task.completed ? { textDecorationLine: 'line-through', opacity: 0.4 } : {},
                    ]}
                    numberOfLines={1}
                  >
                    {st.task.title}
                  </Text>
                  {st.category && (
                    <View style={[styles.allTaskCatDot, { backgroundColor: st.category.color }]} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          <Button mode="contained" onPress={function () { setShowAllTasks(false); }} style={{ marginTop: 12 }}>
            閉じる
          </Button>
        </Modal>
      </Portal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  greeting: {
    flex: 1,
    fontWeight: '600',
  },
  careBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  careBannerText: {
    marginLeft: 8,
    fontSize: 13,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  responseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  responseIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  focusCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  focusContent: {
    padding: 20,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    height: 24,
  },
  focusTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  focusActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  completeButton: {
    flex: 1,
    borderRadius: 12,
  },
  skipButton: {
    flex: 1,
    borderRadius: 12,
  },
  nextTasksList: {
    marginBottom: 8,
  },
  nextTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  nextTaskTitle: {
    flex: 1,
    fontSize: 14,
  },
  priorityChip: {
    marginLeft: 8,
    height: 22,
  },
  showAllButton: {
    marginTop: 4,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    marginTop: 40,
  },
  bottomActions: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rescheduleButton: {
    borderRadius: 12,
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    borderRadius: 28,
  },
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 20,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  reasonEmoji: {
    fontSize: 28,
    marginRight: 16,
  },
  reasonTextArea: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  reasonSub: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 4,
  },
  allTasksModal: {
    margin: 20,
    padding: 24,
    borderRadius: 20,
    maxHeight: '80%',
  },
  allTasksScroll: {
    maxHeight: 400,
  },
  allTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  allTaskCatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
});
