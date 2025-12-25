import { auth, db, isAdmin } from './firebaseConfig.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

let currentUser = null;
let allData = [];
let selectedDataId = null;

// 메뉴 설정 확인 함수
async function checkMenuAccess(user) {
  // 관리자는 항상 접근 가능
  if (isAdmin(user.uid)) {
    return true;
  }

  try {
    const settingsDoc = await getDoc(doc(db, 'menuSettings', 'main'));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      
      // 활동 2가 off인 경우 접근 차단
      if (data.activity2 === false) {
        Swal.fire({
          icon: 'error',
          title: '접근 불가',
          text: '이 페이지는 현재 비활성화되어 있습니다.',
          confirmButtonText: '확인'
        }).then(() => {
          window.location.href = '/index.html';
        });
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('메뉴 설정 확인 오류:', error);
    // 오류 발생 시 접근 허용 (기본값)
    return true;
  }
}

// 인증 상태 확인
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // 메뉴 접근 권한 확인
    const hasAccess = await checkMenuAccess(user);
    if (!hasAccess) {
      return;
    }

    currentUser = user;
    document.getElementById('userInfo').textContent = `👤 ${user.displayName || user.email} 님`;
    document.getElementById('logoutBtn').style.display = 'inline-block';
    loadAllData();
  } else {
    document.getElementById('userInfo').textContent = '🔐 로그인 후 이용해 주세요.';
    document.getElementById('logoutBtn').style.display = 'none';
    Swal.fire({
      icon: 'warning',
      title: '로그인이 필요합니다',
      text: '메인 페이지로 이동합니다.',
      confirmButtonText: '확인'
    }).then(() => {
      window.location.href = '/index.html';
    });
  }
});

// 메인으로 돌아가기 버튼
const backToMainBtn = document.getElementById('backToMainBtn');
if (backToMainBtn) {
  backToMainBtn.addEventListener('click', () => {
    window.location.href = '/index.html';
  });
}

// 로그아웃 버튼
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = '/index.html';
    } catch (error) {
      console.error('로그아웃 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '로그아웃 실패',
        text: '로그아웃 중 오류가 발생했습니다.'
      });
    }
  });
}

// 모든 데이터 불러오기
async function loadAllData() {
  try {
    const listContainer = document.getElementById('dataList');
    listContainer.innerHTML = '<p class="empty-message">데이터를 불러오는 중...</p>';

    // 모든 사용자의 데이터 가져오기 (인덱스 없이 가져온 후 클라이언트에서 정렬)
    const querySnapshot = await getDocs(collection(db, 'probingQuestions'));

    if (querySnapshot.empty) {
      listContainer.innerHTML = '<p class="empty-message">저장된 데이터가 없습니다.</p>';
      return;
    }

    // 사용자 정보 불러오기
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersMap = new Map();
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.uid) {
        usersMap.set(userData.uid, {
          name: userData.name || '',
          affiliation: userData.affiliation || ''
        });
      }
    });

    allData = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();
      
      // 등록된 사용자 정보 가져오기
      const userInfo = usersMap.get(data.uid);
      let displayName = data.displayName || '익명';
      if (userInfo && userInfo.name) {
        displayName = `${userInfo.name}${userInfo.affiliation ? ` (${userInfo.affiliation})` : ''}`;
      }
      
      allData.push({
        id: doc.id,
        ...data,
        createdAt: createdAt,
        displayName: displayName
      });
    });

    // 클라이언트 측에서 최신순 정렬
    allData.sort((a, b) => b.createdAt - a.createdAt);

    renderDataList();
    
  } catch (error) {
    console.error('데이터 불러오기 오류:', error);
    document.getElementById('dataList').innerHTML = '<p class="empty-message">데이터를 불러오는 중 오류가 발생했습니다.</p>';
    Swal.fire({
      icon: 'error',
      title: '불러오기 실패',
      text: error.message || '데이터를 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 데이터 목록 렌더링
function renderDataList() {
  const listContainer = document.getElementById('dataList');
  
  if (allData.length === 0) {
    listContainer.innerHTML = '<p class="empty-message">저장된 데이터가 없습니다.</p>';
    return;
  }

  const listHTML = allData.map((item, index) => {
    const conversation = item.conversation || [];
    const displayName = item.displayName || '익명';
    const dateStr = item.createdAt.toLocaleString('ko-KR');
    
    // 대화 내용 일부 추출 (최대 2개 발화)
    let preview = '';
    if (conversation.length > 0) {
      const previewItems = conversation.slice(0, 2);
      preview = previewItems.map(item => `${item.speaker}: ${item.message}`).join(' / ');
      if (conversation.length > 2) {
        preview += ' ...';
      }
    } else {
      preview = '대화 내용 없음';
    }

    return `
      <div class="data-list-item ${selectedDataId === item.id ? 'active' : ''}" data-id="${item.id}">
        <div class="item-header">
          <span class="item-name">${displayName}</span>
          <span class="item-date">${dateStr}</span>
        </div>
        <div class="item-preview">${preview}</div>
      </div>
    `;
  }).join('');

  listContainer.innerHTML = listHTML;

  // 클릭 이벤트 추가
  listContainer.querySelectorAll('.data-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const itemId = item.getAttribute('data-id');
      selectDataItem(itemId);
    });
  });
}

// 데이터 항목 선택
function selectDataItem(itemId) {
  selectedDataId = itemId;
  const selectedData = allData.find(item => item.id === itemId);
  
  if (!selectedData) {
    return;
  }

  // 목록에서 active 클래스 업데이트
  document.querySelectorAll('.data-list-item').forEach(item => {
    if (item.getAttribute('data-id') === itemId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 상세 내용 렌더링
  renderDetailContent(selectedData);
}

// 상세 내용 렌더링
function renderDetailContent(data) {
  const detailContainer = document.getElementById('detailContent');
  
  const conversation = data.conversation || [];
  const probingQuestions = data.probingQuestions || [];
  const studentCharacteristics = data.studentCharacteristics || '';
  const displayName = data.displayName || '익명';
  const dateStr = data.createdAt.toLocaleString('ko-KR');

  // 학생 특성 섹션
  let characteristicsHTML = '';
  if (studentCharacteristics.trim()) {
    characteristicsHTML = `
      <div class="student-characteristics-section">
        <h3>👤 가상의 학생 특성</h3>
        <div class="student-characteristics-content">${studentCharacteristics}</div>
      </div>
    `;
  }

  // 대화 테이블
  let conversationHTML = '';
  if (conversation.length > 0) {
    const conversationRows = conversation.map(item => `
      <tr>
        <td class="speaker-cell">${item.speaker}</td>
        <td class="message-cell">${item.message}</td>
      </tr>
    `).join('');

    conversationHTML = `
      <div class="content-section">
        <h3>💬 면접관과 학생의 가상 대화</h3>
        <table class="conversation-table">
          <thead>
            <tr>
              <th>발화자</th>
              <th>대화 내용</th>
            </tr>
          </thead>
          <tbody>
            ${conversationRows}
          </tbody>
        </table>
      </div>
    `;
  } else {
    conversationHTML = `
      <div class="content-section">
        <h3>💬 면접관과 학생의 가상 대화</h3>
        <p style="color: #6b7280; font-size: 0.875rem;">대화 내용이 없습니다.</p>
      </div>
    `;
  }

  // 탐침질문 테이블
  let probingHTML = '';
  if (probingQuestions.length > 0) {
    const probingRows = probingQuestions.map(item => `
      <tr>
        <td class="situation-cell">${item.situation || '-'}</td>
        <td class="question-cell">${item.question || '-'}</td>
      </tr>
    `).join('');

    probingHTML = `
      <div class="content-section">
        <h3>❓ 탐침질문</h3>
        <table class="probing-table">
          <thead>
            <tr>
              <th>상황</th>
              <th>탐침질문</th>
            </tr>
          </thead>
          <tbody>
            ${probingRows}
          </tbody>
        </table>
      </div>
    `;
  } else {
    probingHTML = `
      <div class="content-section">
        <h3>❓ 탐침질문</h3>
        <p style="color: #6b7280; font-size: 0.875rem;">탐침질문이 없습니다.</p>
      </div>
    `;
  }

  // 전체 HTML 조합
  detailContainer.innerHTML = `
    <div class="detail-header" style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #1f2937;">${displayName}님의 탐침질문</h2>
      <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">작성일: ${dateStr}</p>
    </div>
    ${characteristicsHTML}
    <div class="content-grid">
      ${conversationHTML}
      ${probingHTML}
    </div>
  `;
}

