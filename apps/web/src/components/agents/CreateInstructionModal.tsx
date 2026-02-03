'use client';

/**
 * CreateInstructionModal Component
 *
 * Modal for creating new agent instructions with rule input,
 * category selection, priority, and optional expiry/conditions.
 * Supports both custom rules and template-based creation.
 */

import { cn } from '@babylon/shared';
import { addDays, addHours, addWeeks } from 'date-fns';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  FileText,
  Heart,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Settings,
  Star,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  CreateInstructionInput,
  InstructionCategory,
  InstructionDirectiveType,
} from '@/hooks/useAgentInstructions';

// =============================================================================
// Template Types (inline to avoid cross-package dependency in browser)
// =============================================================================

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'ticker' | 'date';
  description: string;
  required: boolean;
  min?: number;
  max?: number;
  defaultValue?: string | number;
}

interface InstructionTemplate {
  id: string;
  name: string;
  description: string;
  category: InstructionCategory;
  directiveType: InstructionDirectiveType;
  ruleTemplate: string;
  variables: TemplateVariable[];
  defaultPriority: number;
  suggestedDuration?: string;
}

// Inline templates for browser use
const INSTRUCTION_TEMPLATES: InstructionTemplate[] = [
  {
    id: 'avoid-asset',
    name: 'Avoid Asset',
    description: 'Prevent trading a specific asset',
    category: 'trading',
    directiveType: 'never',
    ruleTemplate: 'Never buy {ticker}',
    variables: [
      {
        name: 'ticker',
        type: 'ticker',
        description: 'Asset ticker (e.g., BTC, ETH)',
        required: true,
      },
    ],
    defaultPriority: 8,
  },
  {
    id: 'price-threshold-buy',
    name: 'Buy Below Price',
    description: 'Only buy when price is below a threshold',
    category: 'trading',
    directiveType: 'until',
    ruleTemplate: 'Only buy {ticker} when price is below ${price}',
    variables: [
      {
        name: 'ticker',
        type: 'ticker',
        description: 'Asset ticker',
        required: true,
      },
      {
        name: 'price',
        type: 'number',
        description: 'Maximum price',
        required: true,
        min: 0,
      },
    ],
    defaultPriority: 7,
  },
  {
    id: 'position-limit',
    name: 'Position Limit',
    description: 'Limit maximum position size per trade',
    category: 'trading',
    directiveType: 'always',
    ruleTemplate: 'Limit position sizes to ${maxSize} points per trade',
    variables: [
      {
        name: 'maxSize',
        type: 'number',
        description: 'Max points per trade',
        required: true,
        min: 1,
      },
    ],
    defaultPriority: 6,
  },
  {
    id: 'focus-predictions',
    name: 'Focus Predictions',
    description: 'Prioritize prediction markets over perps',
    category: 'trading',
    directiveType: 'prefer',
    ruleTemplate:
      'Prioritize prediction market trades over perpetual positions',
    variables: [],
    defaultPriority: 5,
  },
  {
    id: 'conservative-trading',
    name: 'Be Conservative',
    description: 'Trade more conservatively',
    category: 'trading',
    directiveType: 'prefer',
    ruleTemplate:
      'Be conservative - prefer smaller positions and high-confidence opportunities',
    variables: [],
    defaultPriority: 6,
  },
  {
    id: 'increase-engagement',
    name: 'More Engagement',
    description: 'Prioritize social engagement',
    category: 'social',
    directiveType: 'prefer',
    ruleTemplate: 'Prioritize responding to comments and engaging with posts',
    variables: [],
    defaultPriority: 5,
  },
  {
    id: 'no-weekend-trading',
    name: 'No Weekends',
    description: 'Pause trading on weekends',
    category: 'behavior',
    directiveType: 'never',
    ruleTemplate: 'Do not execute any trades on Saturdays or Sundays',
    variables: [],
    defaultPriority: 6,
  },
];

function interpolateTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    if (value === undefined || value === null || value === '') {
      return match;
    }
    return String(value);
  });
}

// =============================================================================
// Types & Constants
// =============================================================================

type CreationMode = 'custom' | 'template';

const CATEGORIES: {
  value: InstructionCategory;
  label: string;
  icon: typeof TrendingUp;
}[] = [
  { value: 'trading', label: 'Trading', icon: TrendingUp },
  { value: 'social', label: 'Social', icon: MessageSquare },
  { value: 'behavior', label: 'Behavior', icon: Settings },
  { value: 'general', label: 'General', icon: Heart },
];

const DIRECTIVE_TYPES: {
  value: InstructionDirectiveType;
  label: string;
  description: string;
  icon: typeof Star;
  color: string;
}[] = [
  {
    value: 'always',
    label: 'Always',
    description: 'Must always follow this rule',
    icon: CheckCircle2,
    color: 'text-green-500 border-green-500/50 bg-green-500/10',
  },
  {
    value: 'never',
    label: 'Never',
    description: 'Must never do this',
    icon: Ban,
    color: 'text-red-500 border-red-500/50 bg-red-500/10',
  },
  {
    value: 'prefer',
    label: 'Prefer',
    description: 'Should prefer this when possible',
    icon: Star,
    color: 'text-blue-500 border-blue-500/50 bg-blue-500/10',
  },
  {
    value: 'avoid',
    label: 'Avoid',
    description: 'Should try to avoid this',
    icon: AlertTriangle,
    color: 'text-orange-500 border-orange-500/50 bg-orange-500/10',
  },
  {
    value: 'until',
    label: 'Until',
    description: 'Follow until condition/date met',
    icon: Clock,
    color: 'text-purple-500 border-purple-500/50 bg-purple-500/10',
  },
];

const DURATION_PRESETS = [
  { label: 'No expiry', value: null },
  { label: '1 hour', value: () => addHours(new Date(), 1).toISOString() },
  { label: '24 hours', value: () => addDays(new Date(), 1).toISOString() },
  { label: '1 week', value: () => addWeeks(new Date(), 1).toISOString() },
  { label: '1 month', value: () => addDays(new Date(), 30).toISOString() },
];

// =============================================================================
// Component
// =============================================================================

interface CreateInstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateInstructionInput) => Promise<boolean>;
  isSubmitting: boolean;
}

export function CreateInstructionModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateInstructionModalProps) {
  // Mode state
  const [mode, setMode] = useState<CreationMode>('custom');

  // Custom form state
  const [rule, setRule] = useState('');
  const [category, setCategory] = useState<InstructionCategory>('trading');
  const [directiveType, setDirectiveType] =
    useState<InstructionDirectiveType>('always');
  const [priority, setPriority] = useState(5);
  const [durationPresetIndex, setDurationPresetIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [templateValues, setTemplateValues] = useState<
    Record<string, string | number>
  >({});

  // Get selected template
  const selectedTemplate = useMemo(
    () => INSTRUCTION_TEMPLATES.find((t) => t.id === selectedTemplateId),
    [selectedTemplateId]
  );

  // Compute preview rule from template
  const templatePreview = useMemo(() => {
    if (!selectedTemplate) return '';
    return interpolateTemplate(selectedTemplate.ruleTemplate, templateValues);
  }, [selectedTemplate, templateValues]);

  // Check if template is valid (all required variables filled)
  const isTemplateValid = useMemo(() => {
    if (!selectedTemplate) return false;
    return selectedTemplate.variables.every((v) => {
      if (!v.required) return true;
      const value = templateValues[v.name];
      return value !== undefined && value !== null && value !== '';
    });
  }, [selectedTemplate, templateValues]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('custom');
      setRule('');
      setCategory('trading');
      setDirectiveType('always');
      setPriority(5);
      setDurationPresetIndex(0);
      setError(null);
      setSelectedTemplateId(null);
      setTemplateValues({});
    }
  }, [isOpen]);

  // Update form when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      setCategory(selectedTemplate.category);
      setDirectiveType(selectedTemplate.directiveType);
      setPriority(selectedTemplate.defaultPriority);
      // Reset template values
      const initialValues: Record<string, string | number> = {};
      for (const variable of selectedTemplate.variables) {
        if (variable.defaultValue !== undefined) {
          initialValues[variable.name] = variable.defaultValue;
        }
      }
      setTemplateValues(initialValues);
    }
  }, [selectedTemplate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalRule: string;
    let finalCategory: InstructionCategory;
    let finalDirectiveType: InstructionDirectiveType;
    let finalPriority: number;

    if (mode === 'template') {
      if (!selectedTemplate || !isTemplateValid) {
        setError('Please fill in all required template fields');
        return;
      }
      finalRule = templatePreview;
      finalCategory = selectedTemplate.category;
      finalDirectiveType = selectedTemplate.directiveType;
      finalPriority = priority;
    } else {
      if (!rule.trim()) {
        setError('Please enter a rule');
        return;
      }
      if (rule.trim().length < 5) {
        setError('Rule must be at least 5 characters');
        return;
      }
      finalRule = rule.trim();
      finalCategory = category;
      finalDirectiveType = directiveType;
      finalPriority = priority;
    }

    const durationPreset = DURATION_PRESETS[durationPresetIndex];
    const validUntil =
      durationPreset?.value === null
        ? null
        : typeof durationPreset?.value === 'function'
          ? durationPreset.value()
          : null;

    const success = await onSubmit({
      rule: finalRule,
      category: finalCategory,
      directiveType: finalDirectiveType,
      priority: finalPriority,
      validUntil,
    });

    if (success) {
      onClose();
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleTemplateValueChange = (name: string, value: string | number) => {
    setTemplateValues((prev) => ({ ...prev, [name]: value }));
  };

  if (!isOpen) return null;

  const selectedDirective = DIRECTIVE_TYPES.find(
    (d) => d.value === directiveType
  );

  const canSubmit =
    mode === 'template' ? isTemplateValid : rule.trim().length >= 5;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-border border-b p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-lg">Create Instruction</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
            disabled={isSubmitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-border bg-sidebar p-1">
              <button
                type="button"
                onClick={() => setMode('custom')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  mode === 'custom'
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                disabled={isSubmitting}
              >
                <Pencil className="h-4 w-4" />
                Custom Rule
              </button>
              <button
                type="button"
                onClick={() => setMode('template')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  mode === 'template'
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                disabled={isSubmitting}
              >
                <FileText className="h-4 w-4" />
                From Template
              </button>
            </div>

            {mode === 'template' ? (
              <>
                {/* Template Selection */}
                <div>
                  <label className="mb-2 block font-medium text-sm">
                    Select Template
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {INSTRUCTION_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={cn(
                          'rounded-lg border p-3 text-left transition-all',
                          selectedTemplateId === template.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-muted-foreground/50'
                        )}
                        disabled={isSubmitting}
                      >
                        <div className="font-medium text-sm">
                          {template.name}
                        </div>
                        <div className="mt-1 line-clamp-2 text-muted-foreground text-xs">
                          {template.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template Variables */}
                {selectedTemplate && selectedTemplate.variables.length > 0 && (
                  <div className="space-y-3">
                    <label className="block font-medium text-sm">
                      Fill in Details
                    </label>
                    {selectedTemplate.variables.map((variable) => (
                      <div key={variable.name}>
                        <label className="mb-1 block text-muted-foreground text-sm">
                          {variable.description}
                          {variable.required && (
                            <span className="text-red-500"> *</span>
                          )}
                        </label>
                        <input
                          type={variable.type === 'number' ? 'number' : 'text'}
                          value={templateValues[variable.name] ?? ''}
                          onChange={(e) =>
                            handleTemplateValueChange(
                              variable.name,
                              variable.type === 'number'
                                ? e.target.valueAsNumber || ''
                                : e.target.value
                            )
                          }
                          placeholder={variable.name}
                          min={variable.min}
                          max={variable.max}
                          className="w-full rounded-lg border border-border bg-sidebar px-3 py-2 transition-colors focus:border-primary focus:outline-none"
                          disabled={isSubmitting}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Template Preview */}
                {selectedTemplate && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="mb-1 font-medium text-primary text-xs">
                      Preview
                    </div>
                    <div className="text-foreground text-sm">
                      {templatePreview || selectedTemplate.ruleTemplate}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Custom Rule Input */}
                <div>
                  <label
                    htmlFor="rule"
                    className="mb-2 block font-medium text-sm"
                  >
                    Rule <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="rule"
                    value={rule}
                    onChange={(e) => setRule(e.target.value)}
                    placeholder="e.g., Never buy BitcAIn above $100k"
                    rows={3}
                    maxLength={500}
                    className="w-full resize-none rounded-lg border border-border bg-sidebar px-4 py-3 transition-colors focus:border-primary focus:outline-none"
                    disabled={isSubmitting}
                  />
                  <p className="mt-1 text-muted-foreground text-xs">
                    {rule.length}/500 characters
                  </p>
                </div>

                {/* Directive Type */}
                <div>
                  <label className="mb-2 block font-medium text-sm">
                    Directive Type
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {DIRECTIVE_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isSelected = directiveType === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setDirectiveType(type.value)}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all',
                            isSelected
                              ? type.color
                              : 'border-border hover:border-muted-foreground/50'
                          )}
                          disabled={isSubmitting}
                        >
                          <Icon
                            className={cn(
                              'h-5 w-5',
                              isSelected ? '' : 'text-muted-foreground'
                            )}
                          />
                          <span
                            className={cn(
                              'font-medium text-xs',
                              isSelected ? '' : 'text-muted-foreground'
                            )}
                          >
                            {type.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedDirective && (
                    <p className="mt-2 text-muted-foreground text-xs">
                      {selectedDirective.description}
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="mb-2 block font-medium text-sm">
                    Category
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.value;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setCategory(cat.value)}
                          className={cn(
                            'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 transition-all',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                          )}
                          disabled={isSubmitting}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="font-medium text-sm">
                            {cat.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Priority */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="font-medium text-sm">Priority</label>
                <span className="font-bold text-primary text-sm">
                  {priority}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full accent-primary"
                disabled={isSubmitting}
              />
              <div className="mt-1 flex justify-between text-muted-foreground text-xs">
                <span>Low (1)</span>
                <span>High (10)</span>
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="mb-2 block font-medium text-sm">Duration</label>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((preset, index) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDurationPresetIndex(index)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-sm transition-all',
                      durationPresetIndex === index
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                    )}
                    disabled={isSubmitting}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex shrink-0 gap-3 border-border border-t p-5">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-lg border border-border bg-sidebar px-4 py-2.5 transition-colors hover:bg-accent"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Instruction
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
