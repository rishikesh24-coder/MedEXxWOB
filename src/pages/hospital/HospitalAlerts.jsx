import React from 'react';
import { useSelector } from 'react-redux';
import AlertsView from '../../components/common/AlertsView';

export const HospitalAlerts = () => {
  const { user } = useSelector((state) => state.auth);

  return (
    <AlertsView 
      portal="hospital" 
      hospitalId={user?.id} 
    />
  );
};

export default HospitalAlerts;
