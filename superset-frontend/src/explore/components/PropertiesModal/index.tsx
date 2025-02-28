/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { ChangeEvent, useMemo, useState, useCallback, useEffect } from 'react';
import React from 'react';

import Modal from 'src/components/Modal';
import { Input, TextArea } from 'src/components/Input';
import Button from 'src/components/Button';
import { AsyncSelect, Row, Col, AntdForm } from 'src/components';
import { SelectValue } from 'antd/lib/select';
import rison from 'rison';
import {
  t,
  SupersetClient,
  styled,
  isFeatureEnabled,
  FeatureFlag,
  getClientErrorObject,
  ensureIsArray,
} from '@superset-ui/core';
import Chart, { Slice } from 'src/types/Chart';
import withToasts from 'src/components/MessageToasts/withToasts';
import { loadTags } from 'src/components/Tags/utils';
import { fetchTags, OBJECT_TYPES } from 'src/features/tags/tags';
import TagType from 'src/types/TagType';

export type PropertiesModalProps = {
  slice: Slice;
  show: boolean;
  onHide: () => void;
  onSave: (chart: Chart) => void;
  permissionsError?: string;
  existingOwners?: SelectValue;
  addSuccessToast: (msg: string) => void;
};

const FormItem = AntdForm.Item;

const StyledFormItem = styled(AntdForm.Item)`
  margin-bottom: 0;
`;

const StyledHelpBlock = styled.span`
  margin-bottom: 0;
`;

function PropertiesModal({
  slice,
  onHide,
  onSave,
  show,
  addSuccessToast,
}: PropertiesModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form] = AntdForm.useForm();
  const [selectedOwners, setSelectedOwners] = useState<SelectValue | null>(
    null,
  );

  const [tags, setTags] = useState<TagType[]>([]);
  const [completeSliceData, setCompleteSliceData] = useState<any>(slice);
  
  // Add a ref to track if the component is mounted
  const isMounted = React.useRef(true);
  
  // Set isMounted to false when the component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const tagsAsSelectValues = useMemo(() => {
    const selectTags = tags.map((tag: { id: number; name: string }) => ({
      value: tag.id,
      label: tag.name,
    }));
    return selectTags;
  }, [tags.length]);

  // Fetch complete chart data if slug is missing
  useEffect(() => {
    let isMounted = true;
    const fetchCompleteChartData = async () => {
      try {
        // Only fetch if slice exists and slug is missing
        if (slice?.slice_id && !slice?.slug) {
          const response = await SupersetClient.get({
            endpoint: `/api/v1/chart/${slice.slice_id}`,
          });
          
          if (!isMounted) return;
          
          const chartData = response.json.result;
          setCompleteSliceData({
            ...slice,
            ...chartData,
          });
          
          // Update the form with the slug value
          if (chartData.slug) {
            form.setFields([
              {
                name: 'slug',
                value: chartData.slug,
              },
            ]);
          }
        }
      } catch (error) {
        // Keep this error log as it's helpful for debugging
        console.error('Error fetching complete chart data:', error);
      }
    };
    
    if (show) {
      fetchCompleteChartData();
    }
    
    return () => {
      isMounted = false;
    };
  }, [slice?.slice_id, slice?.slug, show, form]);

  function showError({ error, statusText, message }: any) {
    let errorText = error || statusText || t('An error has occurred');
    if (message === 'Forbidden') {
      errorText = t('You do not have permission to edit this chart');
    }
    Modal.error({
      title: t('Error'),
      content: errorText,
      okButtonProps: { danger: true, className: 'btn-danger' },
    });
  }

  const fetchChartOwners = useCallback(
    async function fetchChartOwners() {
      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/chart/${slice.slice_id}`,
        });
        const chart = response.json.result;
        
        // Check if component is still mounted before updating state
        if (!isMounted.current) return;
        
        setSelectedOwners(
          chart?.owners?.map((owner: any) => ({
            value: owner.id,
            label: `${owner.first_name} ${owner.last_name}`,
          })),
        );
      } catch (response) {
        if (!isMounted.current) return;
        
        const clientError = await getClientErrorObject(response);
        showError(clientError);
      }
    },
    [slice.slice_id, isMounted],
  );

  const loadOptions = useMemo(
    () =>
      (input = '', page: number, pageSize: number) => {
        const query = rison.encode({
          filter: input,
          page,
          page_size: pageSize,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/chart/related/owners?q=${query}`,
        }).then(response => ({
          data: response.json.result
            .filter((item: { extra: { active: boolean } }) => item.extra.active)
            .map((item: { value: number; text: string }) => ({
              value: item.value,
              label: item.text,
            })),
          totalCount: response.json.count,
        }));
      },
    [],
  );

  const onSubmit = async (values: {
    certified_by?: string;
    certification_details?: string;
    description?: string;
    cache_timeout?: number;
    name?: string;
    slug?: string;
  }) => {
    setSubmitting(true);
    const {
      certified_by: certifiedBy,
      certification_details: certificationDetails,
      description,
      cache_timeout: cacheTimeout,
      name: formName,
      slug: formSlug,
    } = values;
    
    const payload: { [key: string]: any } = {
      slice_name: formName || null,
      slug: formSlug || null,
      description: description || null,
      cache_timeout: cacheTimeout || null,
      certified_by: certifiedBy || null,
      certification_details:
        certifiedBy && certificationDetails ? certificationDetails : null,
    };
    
    if (selectedOwners) {
      payload.owners = (
        selectedOwners as {
          value: number;
          label: string;
        }[]
      ).map(o => o.value);
    }
    if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
      payload.tags = tags.map(tag => tag.id);
    }

    try {
      const res = await SupersetClient.put({
        endpoint: `/api/v1/chart/${slice.slice_id}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      // Check if component is still mounted before updating state
      if (!isMounted.current) return;
      
      // update the redux state, ensuring slug is explicitly included
      const updatedChart = {
        ...payload,
        ...res.json.result,
        // Use any available slug in this priority: form value, API response, existing value
        slug: formSlug || res.json.result.slug || completeSliceData.slug || null, 
        tags,
        id: slice.slice_id,
        owners: selectedOwners,
      };
      onSave(updatedChart);
      addSuccessToast(t('Chart properties updated'));
      onHide();
    } catch (res) {
      // Check if component is still mounted before showing error
      if (!isMounted.current) return;
      
      const clientError = await getClientErrorObject(res);
      showError(clientError);
    } finally {
      // Check if component is still mounted before updating state
      if (isMounted.current) {
        setSubmitting(false);
      }
    }
  };

  const ownersLabel = t('Owners');

  // get the owners of this slice
  useEffect(() => {
    let isMounted = true;
    const fetchOwners = async () => {
      await fetchChartOwners();
    };
    
    fetchOwners();
    
    return () => {
      isMounted = false;
    };
  }, [fetchChartOwners]);

  useEffect(() => {
    if (!isFeatureEnabled(FeatureFlag.TaggingSystem)) return;
    
    let isMounted = true;
    try {
      fetchTags(
        {
          objectType: OBJECT_TYPES.CHART,
          objectId: slice.slice_id,
          includeTypes: false,
        },
        (tags: TagType[]) => {
          if (isMounted) {
            setTags(tags);
          }
        },
        error => {
          if (isMounted) {
            showError(error);
          }
        },
      );
    } catch (error) {
      if (isMounted) {
        showError(error);
      }
    }
    
    return () => {
      isMounted = false;
    };
  }, [slice.slice_id]);

  const handleChangeTags = (tags: { label: string; value: number }[]) => {
    const parsedTags: TagType[] = ensureIsArray(tags).map(r => ({
      id: r.value,
      name: r.label,
    }));
    setTags(parsedTags);
  };

  const handleClearTags = () => {
    setTags([]);
  };

  useEffect(() => {
    // Use completeSliceData if available, otherwise use slice
    const sliceData = completeSliceData || slice;
    if (sliceData) {
      const initialValues = {
        name: sliceData.slice_name || '',
        slug: sliceData.slug || '',
        description: sliceData.description || '',
        cache_timeout: sliceData.cache_timeout != null ? sliceData.cache_timeout : '',
        certified_by: sliceData.certified_by || '',
        certification_details:
          sliceData.certification_details || '',
        is_managed_externally: sliceData.is_managed_externally || false,
        external_url: sliceData.external_url || '',
      };
      form.setFieldsValue(initialValues);
    }
  }, [form, slice, completeSliceData]);

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Edit Chart Properties')}
      footer={
        <>
          <Button
            data-test="properties-modal-cancel-button"
            htmlType="button"
            buttonSize="small"
            onClick={onHide}
            cta
          >
            {t('Cancel')}
          </Button>
          <Button
            data-test="properties-modal-save-button"
            htmlType="submit"
            buttonSize="small"
            buttonStyle="primary"
            onClick={form.submit}
            disabled={submitting || slice.is_managed_externally}
            tooltip={
              slice.is_managed_externally
                ? t(
                    "This chart is managed externally, and can't be edited in Superset",
                  )
                : ''
            }
            cta
          >
            {t('Save')}
          </Button>
        </>
      }
      responsive
      wrapProps={{ 'data-test': 'properties-edit-modal' }}
    >
      <AntdForm
        form={form}
        onFinish={onSubmit}
        layout="vertical"
        initialValues={{
          name: slice.slice_name || '',
          description: slice.description || '',
          cache_timeout: slice.cache_timeout != null ? slice.cache_timeout : '',
          certified_by: slice.certified_by || '',
          certification_details:
            slice.certified_by && slice.certification_details
              ? slice.certification_details
              : '',
          slug: slice.slug || '',
        }}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <h3>{t('Basic information')}</h3>
            <FormItem label={t('Name')} name="name" required>
              <Input
                aria-label={t('Name')}
                data-test="properties-modal-name-input"
                type="text"
              />
            </FormItem>
            <FormItem>
              <StyledFormItem label={t('URL Slug')} name="slug">
                <Input
                  aria-label={t('Slug')}
                  data-test="properties-modal-slug-input"
                  type="text"
                />
              </StyledFormItem>
              <StyledHelpBlock className="help-block">
                {t(
                  'A readable URL for your chart.',
                )}
              </StyledHelpBlock>
            </FormItem>
            <FormItem>
              <StyledFormItem label={t('Description')} name="description">
                <TextArea rows={3} style={{ maxWidth: '100%' }} />
              </StyledFormItem>
              <StyledHelpBlock className="help-block">
                {t(
                  'The description can be displayed as widget headers in the dashboard view. Supports markdown.',
                )}
              </StyledHelpBlock>
            </FormItem>
            <h3>{t('Certification')}</h3>
            <FormItem>
              <StyledFormItem label={t('Certified by')} name="certified_by">
                <Input aria-label={t('Certified by')} />
              </StyledFormItem>
              <StyledHelpBlock className="help-block">
                {t('Person or group that has certified this chart.')}
              </StyledHelpBlock>
            </FormItem>
            <FormItem>
              <StyledFormItem
                label={t('Certification details')}
                name="certification_details"
              >
                <Input aria-label={t('Certification details')} />
              </StyledFormItem>
              <StyledHelpBlock className="help-block">
                {t(
                  'Any additional detail to show in the certification tooltip.',
                )}
              </StyledHelpBlock>
            </FormItem>
          </Col>
          <Col xs={24} md={12}>
            <h3>{t('Configuration')}</h3>
            <FormItem>
              <StyledFormItem label={t('Cache timeout')} name="cache_timeout">
                <Input aria-label="Cache timeout" />
              </StyledFormItem>
              <StyledHelpBlock className="help-block">
                {t(
                  "Duration (in seconds) of the caching timeout for this chart. Set to -1 to bypass the cache. Note this defaults to the dataset's timeout if undefined.",
                )}
              </StyledHelpBlock>
            </FormItem>
            <h3 style={{ marginTop: '1em' }}>{t('Access')}</h3>
            <FormItem label={ownersLabel}>
              <AsyncSelect
                ariaLabel={ownersLabel}
                mode="multiple"
                name="owners"
                value={selectedOwners || []}
                onChange={setSelectedOwners}
                options={loadOptions}
                disabled={!selectedOwners}
                allowClear
              />
              <StyledHelpBlock className="help-block">
                {t(
                  'A list of users who can alter the chart. Searchable by name or username.',
                )}
              </StyledHelpBlock>
            </FormItem>
            {isFeatureEnabled(FeatureFlag.TaggingSystem) && (
              <h3 css={{ marginTop: '1em' }}>{t('Tags')}</h3>
            )}
            {isFeatureEnabled(FeatureFlag.TaggingSystem) && (
              <FormItem>
                <AsyncSelect
                  ariaLabel="Tags"
                  mode="multiple"
                  value={tagsAsSelectValues}
                  options={loadTags}
                  onChange={handleChangeTags}
                  onClear={handleClearTags}
                  allowClear
                />
                <StyledHelpBlock className="help-block">
                  {t('A list of tags that have been applied to this chart.')}
                </StyledHelpBlock>
              </FormItem>
            )}
          </Col>
        </Row>
      </AntdForm>
    </Modal>
  );
}

export default withToasts(PropertiesModal);
