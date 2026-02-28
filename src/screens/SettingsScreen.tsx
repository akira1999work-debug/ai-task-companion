import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Surface,
  Switch,
  useTheme,
  Divider,
  IconButton,
  RadioButton,
  List,
  TextInput,
  Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import type { PersonalityType, PersonalityConfig, ConnectionMode } from '../types';
import { checkOllamaConnection } from '../services/aiProvider';
import { useNavigation } from '@react-navigation/native';

const PERSONALITIES: PersonalityConfig[] = [
  {
    id: 'standard',
    name: 'スタンダード',
    description: 'バランスの取れた標準アシスタント',
    icon: 'robot-happy-outline',
    isPremium: false,
  },
  {
    id: 'yuru',
    name: 'ゆるモード',
    description: 'ふわふわ・ギャル風の暖かいアシスタント',
    icon: 'emoticon-happy-outline',
    isPremium: true,
  },
  {
    id: 'maji',
    name: 'マジモード',
    description: 'ストイック・クールな効率重視アシスタント',
    icon: 'glasses',
    isPremium: true,
  },
];

function PersonalityCard({
  config,
  selected,
  onSelect,
}: {
  config: PersonalityConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();

  const cardColors: Record<PersonalityType, { bg: string; accent: string }> = {
    standard: { bg: theme.colors.surfaceVariant, accent: theme.colors.primary },
    yuru: { bg: '#FFF1F2', accent: '#F472B6' },
    maji: { bg: '#1E293B', accent: '#3B82F6' },
  };

  const colors = cardColors[config.id];

  return (
    <Surface
      style={[
        styles.personalityCard,
        {
          backgroundColor: colors.bg,
          borderColor: selected ? colors.accent : 'transparent',
          borderWidth: 2,
        },
      ]}
      elevation={selected ? 3 : 1}
    >
      <View style={styles.personalityContent} onTouchEnd={onSelect}>
        <View style={styles.personalityHeader}>
          <MaterialCommunityIcons
            name={config.icon as any}
            size={32}
            color={colors.accent}
          />
          <View style={styles.personalityText}>
            <View style={styles.personalityNameRow}>
              <Text
                variant="titleMedium"
                style={{
                  fontWeight: '600',
                  color: config.id === 'maji' ? '#E2E8F0' : theme.colors.onSurface,
                }}
              >
                {config.name}
              </Text>
              {config.isPremium && (
                <View style={[styles.premiumBadge, { backgroundColor: colors.accent }]}>
                  <MaterialCommunityIcons name="crown" size={12} color="#FFFFFF" />
                  <Text style={styles.premiumText}>PRO</Text>
                </View>
              )}
            </View>
            <Text
              variant="bodySmall"
              style={{
                color: config.id === 'maji' ? '#94A3B8' : theme.colors.outline,
                marginTop: 2,
              }}
            >
              {config.description}
            </Text>
          </View>
          <RadioButton
            value={config.id}
            status={selected ? 'checked' : 'unchecked'}
            onPress={onSelect}
            color={colors.accent}
          />
        </View>
      </View>
    </Surface>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const {
    personality, setPersonality,
    googleCalendarEnabled, setGoogleCalendarEnabled,
    aiConfig, setConnectionMode, setOllamaHost, setOllamaPort, setGeminiApiKey,
    insightVisualizationStyle, setInsightVisualizationStyle,
  } = useApp();

  const [localHost, setLocalHost] = useState(aiConfig.ollamaHost);
  const [localPort, setLocalPort] = useState(aiConfig.ollamaPort);
  const [localApiKey, setLocalApiKey] = useState(aiConfig.geminiApiKey);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleConnectionTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const ok = await checkOllamaConnection(aiConfig.ollamaHost, aiConfig.ollamaPort);
    setTestResult(ok ? 'Ollama接続成功' : 'Ollama接続失敗 — サーバーが起動していることを確認してください');
    setIsTesting(false);
  };

  const showOllamaSettings = aiConfig.connectionMode === 'local' || aiConfig.connectionMode === 'hybrid';
  const showGeminiSettings = aiConfig.connectionMode === 'cloud' || aiConfig.connectionMode === 'hybrid';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
          iconColor={theme.colors.onBackground}
        />
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onBackground }]}>
          設定
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Personality section */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          AIパーソナリティ
        </Text>
        <Text variant="bodySmall" style={[styles.sectionDesc, { color: theme.colors.outline }]}>
          アシスタントの性格とテーマを選択してください
        </Text>

        {PERSONALITIES.map(p => (
          <PersonalityCard
            key={p.id}
            config={p}
            selected={personality === p.id}
            onSelect={() => setPersonality(p.id)}
          />
        ))}

        <Divider style={styles.divider} />

        {/* AI Connection section */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          AI接続
        </Text>
        <Text variant="bodySmall" style={[styles.sectionDesc, { color: theme.colors.outline }]}>
          AIプロバイダーの接続設定
        </Text>

        <Surface style={[styles.settingRow, { backgroundColor: theme.colors.surface, flexDirection: 'column', alignItems: 'stretch' }]} elevation={1}>
          <View style={styles.radioRow}>
            <RadioButton
              value="local"
              status={aiConfig.connectionMode === 'local' ? 'checked' : 'unchecked'}
              onPress={() => setConnectionMode('local')}
              color={theme.colors.primary}
            />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }} onPress={() => setConnectionMode('local')}>
              ローカル (Ollama)
            </Text>
          </View>
          <View style={styles.radioRow}>
            <RadioButton
              value="cloud"
              status={aiConfig.connectionMode === 'cloud' ? 'checked' : 'unchecked'}
              onPress={() => setConnectionMode('cloud')}
              color={theme.colors.primary}
            />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }} onPress={() => setConnectionMode('cloud')}>
              クラウド (Gemini)
            </Text>
          </View>
          <View style={styles.radioRow}>
            <RadioButton
              value="hybrid"
              status={aiConfig.connectionMode === 'hybrid' ? 'checked' : 'unchecked'}
              onPress={() => setConnectionMode('hybrid')}
              color={theme.colors.primary}
            />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }} onPress={() => setConnectionMode('hybrid')}>
              ハイブリッド (自動)
            </Text>
          </View>
        </Surface>

        {showOllamaSettings && (
          <Surface style={[styles.settingRow, { backgroundColor: theme.colors.surface, flexDirection: 'column', alignItems: 'stretch' }]} elevation={1}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
              Ollama設定
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                mode="outlined"
                label="ホスト"
                value={localHost}
                onChangeText={setLocalHost}
                onBlur={() => setOllamaHost(localHost)}
                style={{ flex: 2 }}
                dense
              />
              <TextInput
                mode="outlined"
                label="ポート"
                value={localPort}
                onChangeText={setLocalPort}
                onBlur={() => setOllamaPort(localPort)}
                keyboardType="numeric"
                style={{ flex: 1 }}
                dense
              />
            </View>
            <Button
              mode="outlined"
              onPress={handleConnectionTest}
              loading={isTesting}
              disabled={isTesting}
              style={{ marginTop: 8, alignSelf: 'flex-start' }}
              icon="connection"
              compact
            >
              接続テスト
            </Button>
            {testResult && (
              <Text
                variant="bodySmall"
                style={{
                  marginTop: 4,
                  color: testResult.includes('成功') ? '#22C55E' : theme.colors.error,
                }}
              >
                {testResult}
              </Text>
            )}
          </Surface>
        )}

        {showGeminiSettings && (
          <Surface style={[styles.settingRow, { backgroundColor: theme.colors.surface, flexDirection: 'column', alignItems: 'stretch' }]} elevation={1}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
              Gemini設定
            </Text>
            <TextInput
              mode="outlined"
              label="APIキー"
              value={localApiKey}
              onChangeText={setLocalApiKey}
              onBlur={() => setGeminiApiKey(localApiKey)}
              secureTextEntry
              dense
            />
          </Surface>
        )}

        <Divider style={styles.divider} />

        {/* Display settings section */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          表示設定
        </Text>

        <Surface style={[styles.settingRow, { backgroundColor: theme.colors.surface, flexDirection: 'column', alignItems: 'stretch' }]} elevation={1}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
            インサイト表示スタイル
          </Text>
          <View style={styles.radioRow}>
            <RadioButton
              value="tiles"
              status={insightVisualizationStyle === 'tiles' ? 'checked' : 'unchecked'}
              onPress={() => setInsightVisualizationStyle('tiles')}
              color={theme.colors.primary}
            />
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface }}
              onPress={() => setInsightVisualizationStyle('tiles')}
            >
              タイルビュー
            </Text>
          </View>
          <View style={styles.radioRow}>
            <RadioButton
              value="bars"
              status={insightVisualizationStyle === 'bars' ? 'checked' : 'unchecked'}
              onPress={() => setInsightVisualizationStyle('bars')}
              color={theme.colors.primary}
            />
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface }}
              onPress={() => setInsightVisualizationStyle('bars')}
            >
              バービュー (ミキシングコンソール)
            </Text>
          </View>
        </Surface>

        <Divider style={styles.divider} />

        {/* Integrations section */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          連携
        </Text>

        <Surface style={[styles.settingRow, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.settingInfo}>
            <MaterialCommunityIcons
              name="google"
              size={24}
              color={theme.colors.primary}
            />
            <View style={styles.settingText}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                Googleカレンダー
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                タスクをカレンダーに同期
              </Text>
            </View>
          </View>
          <Switch
            value={googleCalendarEnabled}
            onValueChange={setGoogleCalendarEnabled}
            color={theme.colors.primary}
          />
        </Surface>

        <Divider style={styles.divider} />

        {/* Habits section */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          習慣管理
        </Text>

        <Surface style={[styles.settingRow, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.settingInfo}>
            <MaterialCommunityIcons
              name="repeat"
              size={24}
              color={theme.colors.primary}
            />
            <View style={styles.settingText}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                繰り返しタスク
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                日次・週次・月次の習慣を管理
              </Text>
            </View>
          </View>
          <IconButton
            icon="chevron-right"
            size={24}
            iconColor={theme.colors.outline}
          />
        </Surface>

        <Surface style={[styles.settingRow, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.settingInfo}>
            <MaterialCommunityIcons
              name="bell-outline"
              size={24}
              color={theme.colors.primary}
            />
            <View style={styles.settingText}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                リマインダー
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                通知でタスクを忘れない
              </Text>
            </View>
          </View>
          <IconButton
            icon="chevron-right"
            size={24}
            iconColor={theme.colors.outline}
          />
        </Surface>

        <Divider style={styles.divider} />

        {/* About */}
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          アプリについて
        </Text>

        <Surface style={[styles.settingRow, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.settingInfo}>
            <MaterialCommunityIcons
              name="information-outline"
              size={24}
              color={theme.colors.primary}
            />
            <View style={styles.settingText}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                アイタス
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                バージョン 0.1.0 (プロトタイプ)
              </Text>
            </View>
          </View>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  title: {
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 4,
  },
  sectionDesc: {
    marginBottom: 12,
  },
  personalityCard: {
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  personalityContent: {
    padding: 16,
  },
  personalityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  personalityText: {
    flex: 1,
    marginLeft: 12,
  },
  personalityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  premiumText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    marginTop: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
});
