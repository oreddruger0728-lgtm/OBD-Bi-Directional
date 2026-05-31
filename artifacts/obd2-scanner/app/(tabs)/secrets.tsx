import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  BUILT_IN_TRICKS, CATEGORY_COLORS, TRICK_CATEGORIES, TRICK_MAKES,
  type SecretTrick, type TrickCategory,
} from "@/utils/secretsTricks";
import { OBD_PROTOCOLS, AT_COMMANDS, OBD2_PINS, type OBDProtocol } from "@/utils/obdProtocols";

const STORAGE_KEY = "obd2_custom_tricks";

type ScreenView = "tricks" | "protocols" | "pins" | "atcmds";

const VIEW_LABELS: { id: ScreenView; label: string; icon: string }[] = [
  { id: "tricks", label: "Tricks", icon: "star" },
  { id: "protocols", label: "Protocols", icon: "radio" },
  { id: "pins", label: "Pin Map", icon: "cpu" },
  { id: "atcmds", label: "AT Cmds", icon: "terminal" },
];

const PROTOCOL_CATEGORY_COLORS: Record<string, string> = {
  CAN: "#00D4FF",
  Legacy: "#F59E0B",
  "Heavy Duty": "#34D399",
  Manufacturer: "#E879F9",
};

function TrickDifficultyBadge({ level }: { level: string }) {
  const color = level === "Easy" ? "#00E87A" : level === "Medium" ? "#FFB800" : "#FF6B6B";
  return (
    <View style={[styles.diffBadge, { backgroundColor: color + "25" }]}>
      <Text style={[styles.diffBadgeText, { color }]}>{level}</Text>
    </View>
  );
}

function TrickCard({ trick, onPress }: { trick: SecretTrick; onPress: () => void }) {
  const colors = useColors();
  const catColor = CATEGORY_COLORS[trick.category] ?? colors.primary;
  return (
    <TouchableOpacity
      style={[styles.trickCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: catColor }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.trickCardHeader}>
        <View style={[styles.catDot, { backgroundColor: catColor }]} />
        <Text style={[styles.trickCat, { color: catColor }]}>{trick.category}</Text>
        <TrickDifficultyBadge level={trick.difficulty} />
        {trick.source === "user" && (
          <View style={[styles.userBadge, { backgroundColor: "#34D39920" }]}>
            <Feather name="user" size={9} color="#34D399" />
            <Text style={[styles.userBadgeText, { color: "#34D399" }]}>Mine</Text>
          </View>
        )}
      </View>
      <Text style={[styles.trickTitle, { color: colors.foreground }]}>{trick.title}</Text>
      {trick.makes.length > 0 && (
        <View style={styles.makesRow}>
          {trick.makes.slice(0, 4).map((m) => (
            <View key={m} style={[styles.makeBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.makeBadgeText, { color: colors.mutedForeground }]}>{m}</Text>
            </View>
          ))}
          {trick.makes.length > 4 && <Text style={[styles.makeBadgeText, { color: colors.mutedForeground }]}>+{trick.makes.length - 4}</Text>}
        </View>
      )}
      <Text style={[styles.trickDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
        {trick.description}
      </Text>
      {trick.pinNote && (
        <View style={[styles.pinNoteRow, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B30" }]}>
          <Feather name="cpu" size={10} color="#F59E0B" />
          <Text style={[styles.pinNoteText, { color: "#F59E0B" }]}>{trick.pinNote}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function TrickDetail({ trick, onClose, onDelete }: { trick: SecretTrick; onClose: () => void; onDelete?: () => void }) {
  const colors = useColors();
  const catColor = CATEGORY_COLORS[trick.category] ?? colors.primary;
  return (
    <View style={[styles.detailSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
        <View style={styles.detailTitleRow}>
          <View style={[styles.detailCatBadge, { backgroundColor: catColor + "20" }]}>
            <Text style={[styles.detailCatText, { color: catColor }]}>{trick.category}</Text>
          </View>
          <TrickDifficultyBadge level={trick.difficulty} />
          {trick.source === "user" && onDelete && (
            <TouchableOpacity style={[styles.deleteTrickBtn, { borderColor: "#FF4444" }]} onPress={onDelete}>
              <Feather name="trash-2" size={13} color="#FF4444" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={{ marginLeft: "auto" }}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.detailTitle, { color: colors.foreground }]}>{trick.title}</Text>

        {trick.makes.length > 0 && (
          <View style={styles.makesRow}>
            {trick.makes.map((m) => (
              <View key={m} style={[styles.makeBadge, { backgroundColor: catColor + "15", borderColor: catColor + "40" }]}>
                <Text style={[styles.makeBadgeText, { color: catColor }]}>{m}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.detailDesc, { color: colors.foreground }]}>{trick.description}</Text>

        {trick.warning && (
          <View style={[styles.warningBox, { backgroundColor: "#FFB80015", borderColor: "#FFB800" }]}>
            <Feather name="alert-triangle" size={13} color="#FFB800" />
            <Text style={styles.warningText}>{trick.warning}</Text>
          </View>
        )}

        {trick.pinNote && (
          <View style={[styles.pinBox, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B" }]}>
            <Feather name="cpu" size={13} color="#F59E0B" />
            <Text style={[styles.pinBoxText, { color: "#F59E0B" }]}>{trick.pinNote}</Text>
          </View>
        )}

        {trick.steps && trick.steps.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={[styles.stepsLabel, { color: colors.mutedForeground }]}>PROCEDURE</Text>
            {trick.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={[styles.stepNum, { backgroundColor: catColor + "30" }]}>
                  <Text style={[styles.stepNumText, { color: catColor }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepText, { color: colors.foreground }]}>{step}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function AddTrickModal({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (t: SecretTrick) => void }) {
  const colors = useColors();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TrickCategory>("Community Tip");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Advanced">("Easy");
  const [selectedMakes, setSelectedMakes] = useState<string[]>(["All"]);
  const [description, setDescription] = useState("");
  const [stepsRaw, setStepsRaw] = useState("");
  const [pinNote, setPinNote] = useState("");
  const [warning, setWarning] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle(""); setCategory("Community Tip"); setDifficulty("Easy");
    setSelectedMakes(["All"]); setDescription(""); setStepsRaw("");
    setPinNote(""); setWarning("");
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Required Fields", "Title and description are required.");
      return;
    }
    setSaving(true);
    const steps = stepsRaw.split("\n").map((s) => s.trim()).filter(Boolean);
    const trick: SecretTrick = {
      id: `user_${Date.now()}`,
      title: title.trim(),
      category,
      difficulty,
      makes: selectedMakes.length === 0 ? ["All"] : selectedMakes,
      description: description.trim(),
      steps: steps.length > 0 ? steps : undefined,
      pinNote: pinNote.trim() || undefined,
      warning: warning.trim() || undefined,
      source: "user",
      createdAt: new Date().toISOString(),
    };
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAdd(trick);
    reset();
    setSaving(false);
    onClose();
  };

  const toggleMake = (make: string) => {
    if (make === "All") { setSelectedMakes(["All"]); return; }
    setSelectedMakes((prev) => {
      const filtered = prev.filter((m) => m !== "All");
      return filtered.includes(make) ? filtered.filter((m) => m !== make) : [...filtered, make];
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Tip / Trick</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TITLE *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={title} onChangeText={setTitle}
              placeholder="Short descriptive title"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {TRICK_CATEGORIES.map((c) => {
                const color = CATEGORY_COLORS[c];
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, { backgroundColor: category === c ? color + "25" : colors.card, borderColor: category === c ? color : colors.border }]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.chipText, { color: category === c ? color : colors.mutedForeground }]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DIFFICULTY</Text>
            <View style={styles.chipRow}>
              {(["Easy", "Medium", "Advanced"] as const).map((d) => {
                const color = d === "Easy" ? "#00E87A" : d === "Medium" ? "#FFB800" : "#FF6B6B";
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, { backgroundColor: difficulty === d ? color + "25" : colors.card, borderColor: difficulty === d ? color : colors.border }]}
                    onPress={() => setDifficulty(d)}
                  >
                    <Text style={[styles.chipText, { color: difficulty === d ? color : colors.mutedForeground }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>APPLIES TO (tap to select)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {TRICK_MAKES.slice(0, 20).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, { backgroundColor: selectedMakes.includes(m) ? colors.primary + "25" : colors.card, borderColor: selectedMakes.includes(m) ? colors.primary : colors.border }]}
                  onPress={() => toggleMake(m)}
                >
                  <Text style={[styles.chipText, { color: selectedMakes.includes(m) ? colors.primary : colors.mutedForeground }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESCRIPTION *</Text>
            <TextInput
              style={[styles.inputMulti, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={description} onChangeText={setDescription}
              placeholder="Explain what this trick does and when to use it"
              placeholderTextColor={colors.mutedForeground}
              multiline numberOfLines={4} textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>STEPS (one per line — optional)</Text>
            <TextInput
              style={[styles.inputMulti, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={stepsRaw} onChangeText={setStepsRaw}
              placeholder={"Step 1\nStep 2\nStep 3"}
              placeholderTextColor={colors.mutedForeground}
              multiline numberOfLines={5} textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PIN NOTES (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={pinNote} onChangeText={setPinNote}
              placeholder="e.g. Pin 7 → Pin 4 (K-Line to Ground)"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>WARNING (optional)</Text>
            <TextInput
              style={[styles.inputMulti, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={warning} onChangeText={setWarning}
              placeholder="Any safety warnings or cautions"
              placeholderTextColor={colors.mutedForeground}
              multiline numberOfLines={3} textAlignVertical="top"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function SecretsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ScreenView>("tricks");
  const [customTricks, setCustomTricks] = useState<SecretTrick[]>([]);
  const [selectedTrick, setSelectedTrick] = useState<SecretTrick | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("All");
  const [filterMake, setFilterMake] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [protocolFilter, setProtocolFilter] = useState<string>("All");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v) { try { setCustomTricks(JSON.parse(v)); } catch {} }
    });
  }, []);

  const saveCustomTricks = async (tricks: SecretTrick[]) => {
    setCustomTricks(tricks);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tricks));
  };

  const handleAddTrick = (trick: SecretTrick) => {
    const updated = [...customTricks, trick];
    saveCustomTricks(updated);
  };

  const handleDeleteTrick = (id: string) => {
    Alert.alert("Delete Tip", "Remove this custom tip?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const updated = customTricks.filter((t) => t.id !== id);
          saveCustomTricks(updated);
          setSelectedTrick(null);
        },
      },
    ]);
  };

  const allTricks = [...BUILT_IN_TRICKS, ...customTricks];
  const filteredTricks = allTricks.filter((t) => {
    if (filterCat !== "All" && t.category !== filterCat) return false;
    if (filterMake !== "All" && !t.makes.includes(filterMake) && !t.makes.includes("All")) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q) && !t.makes.join(" ").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredProtocols = OBD_PROTOCOLS.filter((p) =>
    protocolFilter === "All" ? true : p.category === protocolFilter
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.subNav, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {VIEW_LABELS.map(({ id, label, icon }) => (
          <TouchableOpacity
            key={id}
            style={[styles.subNavBtn, view === id && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setView(id)}
          >
            <Feather name={icon as any} size={12} color={view === id ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.subNavText, { color: view === id ? colors.primary : colors.mutedForeground }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === "tricks" && (
        <>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={[styles.searchInput, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchText, { color: colors.foreground }]}
                value={search} onChangeText={setSearch}
                placeholder="Search tricks, makes, keywords..."
                placeholderTextColor={colors.mutedForeground}
              />
              {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={14} color={colors.mutedForeground} /></TouchableOpacity> : null}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {["All", ...TRICK_CATEGORIES].map((cat) => {
              const color = cat !== "All" ? (CATEGORY_COLORS[cat as TrickCategory] ?? colors.primary) : colors.primary;
              const active = filterCat === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.filterChip, { backgroundColor: active ? color + "25" : colors.card, borderColor: active ? color : colors.border }]}
                  onPress={() => setFilterCat(cat)}
                >
                  <Text style={[styles.filterChipText, { color: active ? color : colors.mutedForeground }]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <FlatList
            data={filteredTricks}
            keyExtractor={(t) => t.id}
            renderItem={({ item }) => (
              <TrickCard trick={item} onPress={() => setSelectedTrick(item)} />
            )}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={[styles.counterRow]}>
                <Text style={[styles.counterText, { color: colors.mutedForeground }]}>
                  {filteredTricks.length} trick{filteredTricks.length !== 1 ? "s" : ""} · {customTricks.length} custom
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="star" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No tricks match your filter</Text>
              </View>
            }
          />

          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 90 }]}
            onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setAddModalVisible(true); }}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={22} color="#000" />
          </TouchableOpacity>

          {selectedTrick && (
            <View style={[styles.overlay, { backgroundColor: "#000000CC" }]}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setSelectedTrick(null)} />
              <TrickDetail
                trick={selectedTrick}
                onClose={() => setSelectedTrick(null)}
                onDelete={selectedTrick.source === "user" ? () => handleDeleteTrick(selectedTrick.id) : undefined}
              />
            </View>
          )}

          <AddTrickModal
            visible={addModalVisible}
            onClose={() => setAddModalVisible(false)}
            onAdd={handleAddTrick}
          />
        </>
      )}

      {view === "protocols" && (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {["All", "CAN", "Legacy", "Heavy Duty"].map((cat) => {
              const color = cat !== "All" ? (PROTOCOL_CATEGORY_COLORS[cat] ?? colors.primary) : colors.primary;
              const active = protocolFilter === cat;
              return (
                <TouchableOpacity key={cat} style={[styles.filterChip, { backgroundColor: active ? color + "25" : colors.card, borderColor: active ? color : colors.border }]} onPress={() => setProtocolFilter(cat)}>
                  <Text style={[styles.filterChipText, { color: active ? color : colors.mutedForeground }]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredProtocols.map((p) => {
            const catColor = PROTOCOL_CATEGORY_COLORS[p.category] ?? colors.primary;
            return (
              <View key={p.id} style={[styles.protoCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: catColor }]}>
                <View style={styles.protoHeader}>
                  <View style={[styles.atCodeBadge, { backgroundColor: catColor + "20" }]}>
                    <Text style={[styles.atCodeText, { color: catColor }]}>{p.atCode}</Text>
                  </View>
                  <Text style={[styles.protoShortName, { color: colors.foreground }]}>{p.shortName}</Text>
                  <View style={[styles.protoCatBadge, { backgroundColor: catColor + "15" }]}>
                    <Text style={[styles.protoCatText, { color: catColor }]}>{p.category}</Text>
                  </View>
                </View>
                <Text style={[styles.protoFullName, { color: colors.foreground }]}>{p.name}</Text>
                <View style={styles.protoMetaRow}>
                  <View style={styles.protoMeta}><Feather name="zap" size={10} color={colors.mutedForeground} /><Text style={[styles.protoMetaText, { color: colors.mutedForeground }]}>{p.speed}</Text></View>
                  <View style={styles.protoMeta}><Feather name="cpu" size={10} color={colors.mutedForeground} /><Text style={[styles.protoMetaText, { color: colors.mutedForeground }]}>{p.pins}</Text></View>
                  <View style={styles.protoMeta}><Feather name="calendar" size={10} color={colors.mutedForeground} /><Text style={[styles.protoMetaText, { color: colors.mutedForeground }]}>{p.era}</Text></View>
                </View>
                <View style={styles.coverageRow}>
                  {p.coverage.map((c) => (
                    <View key={c} style={[styles.coverageBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Text style={[styles.coverageBadgeText, { color: colors.mutedForeground }]}>{c}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.protoNotes, { color: colors.mutedForeground }]}>{p.notes}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {view === "pins" && (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
          <View style={[styles.pinDiagramLabel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={12} color={colors.primary} />
            <Text style={[styles.pinDiagramText, { color: colors.mutedForeground }]}>OBD2 / SAE J1962 Type A Connector — 16 pins</Text>
          </View>
          {OBD2_PINS.map((p) => {
            const isSpecial = [6, 14, 7, 16, 4, 5].includes(p.pin);
            const pinColor = p.pin === 16 ? "#F59E0B" : p.pin === 6 || p.pin === 14 ? "#00D4FF" : p.pin === 7 ? "#A78BFA" : p.pin === 4 || p.pin === 5 ? "#34D399" : colors.mutedForeground;
            return (
              <View key={p.pin} style={[styles.pinRow, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: isSpecial ? pinColor : colors.border }]}>
                <View style={[styles.pinNum, { backgroundColor: pinColor + "20", borderColor: pinColor + "40" }]}>
                  <Text style={[styles.pinNumText, { color: pinColor }]}>{p.pin}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pinLabel, { color: colors.foreground }]}>{p.label}</Text>
                  <Text style={[styles.pinDesc, { color: colors.mutedForeground }]}>{p.description}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {view === "atcmds" && (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
          {["General", "Protocol", "CAN", "Formatting", "Monitor", "Timing", "Legacy", "Advanced"].map((cat) => {
            const cmds = AT_COMMANDS.filter((c) => c.category === cat);
            if (cmds.length === 0) return null;
            return (
              <View key={cat} style={[styles.cmdGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.cmdGroupHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.cmdGroupTitle, { color: colors.foreground }]}>{cat}</Text>
                </View>
                {cmds.map((cmd) => (
                  <View key={cmd.command} style={[styles.cmdRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.cmdCode, { color: colors.primary }]}>{cmd.command}</Text>
                    <Text style={[styles.cmdDesc, { color: colors.foreground }]}>{cmd.description}</Text>
                    {cmd.example && (
                      <View style={[styles.cmdExample, { backgroundColor: colors.secondary }]}>
                        <Text style={[styles.cmdExampleText, { color: colors.mutedForeground }]}>e.g. {cmd.example}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  subNav: { flexDirection: "row", borderBottomWidth: 1 },
  subNavBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 9 },
  subNavText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  searchBar: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  searchInput: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 36 },
  searchText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  filterChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  list: { padding: 12, paddingTop: 0 },
  counterRow: { paddingVertical: 6 },
  counterText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  trickCard: { borderWidth: 1, borderLeftWidth: 3, borderRadius: 10, padding: 12, marginBottom: 8, gap: 6 },
  trickCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  trickCat: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  diffBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  diffBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  userBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  userBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  trickTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  makesRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  makeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  makeBadgeText: { fontSize: 9, fontFamily: "Inter_500Medium" },
  trickDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  pinNoteRow: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  pinNoteText: { fontSize: 10, fontFamily: "Inter_500Medium", flex: 1 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  fab: { position: "absolute", right: 20, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", elevation: 6 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  detailSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, maxHeight: "85%", paddingBottom: 0 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  detailTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailCatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  detailCatText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  deleteTrickBtn: { padding: 4, borderWidth: 1, borderRadius: 5 },
  detailTitle: { fontSize: 17, fontFamily: "Inter_700Bold", lineHeight: 22 },
  detailDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  warningBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  warningText: { color: "#FFB800", fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 16 },
  pinBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  pinBoxText: { fontSize: 11, fontFamily: "Inter_600SemiBold", flex: 1 },
  stepsLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  stepText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, paddingTop: 2 },
  scroll: { padding: 12, gap: 10 },
  protoCard: { borderWidth: 1, borderLeftWidth: 3, borderRadius: 10, padding: 12, gap: 6 },
  protoHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  atCodeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  atCodeText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  protoShortName: { fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 },
  protoCatBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  protoCatText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  protoFullName: { fontSize: 12, fontFamily: "Inter_500Medium" },
  protoMetaRow: { flexDirection: "row", gap: 12 },
  protoMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  protoMetaText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  coverageRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  coverageBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  coverageBadgeText: { fontSize: 9, fontFamily: "Inter_500Medium" },
  protoNotes: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  pinDiagramLabel: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 2 },
  pinDiagramText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  pinRow: { borderWidth: 1, borderLeftWidth: 3, borderRadius: 8, flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 10, marginBottom: 5 },
  pinNum: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pinNumText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  pinLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pinDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, marginTop: 2 },
  cmdGroup: { borderRadius: 10, borderWidth: 1, overflow: "hidden", marginBottom: 8 },
  cmdGroupHeader: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  cmdGroupTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  cmdRow: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, gap: 3 },
  cmdCode: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  cmdDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  cmdExample: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  cmdExampleText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalCancel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  modalSave: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalScroll: { padding: 16, gap: 6, paddingBottom: 60 },
  fieldLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 44, fontSize: 13, fontFamily: "Inter_400Regular" },
  inputMulti: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 90 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
